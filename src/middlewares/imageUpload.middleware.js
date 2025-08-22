import dotenv from "dotenv";
dotenv.config();

import sharp from "sharp";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

/*
──────────────────────────────────────────────────────────────────────────────
  🚀 Render-safe image upload middleware
  - Replaces diskStorage + local `/uploads` with memoryStorage (buffers)
  - Processes images with Sharp entirely in memory
  - Uploads to Cloudinary using upload_stream (no temp files)
  - Keeps the same external API of your previous middlewares
    * uploaderMiddleware (business): fields for featured/profile/images
    * imageProcessor (business): sets req.body URLs
    * singleProfileImageUpload + handleProfileImage
    * uploadCommunityImages (any) + processCommunityImages
──────────────────────────────────────────────────────────────────────────────
*/

/* ─────────────────────────────────────────────────────────
 *  Cloudinary config
 * ───────────────────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ─────────────────────────────────────────────────────────
 *  Multer (memoryStorage) — NO FILESYSTEM
 * ───────────────────────────────────────────────────────── */
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por archivo (ajusta a tu gusto)
    files: 30, // evita bombazos
  },
});

export const uploaderMiddleware = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

/* ─────────────────────────────────────────────────────────
 *  Helpers de procesamiento en memoria
 * ───────────────────────────────────────────────────────── */

/**
 * Procesa un buffer de imagen con Sharp (rotate + resize) y lo convierte
 * a un formato comprimido. Preferimos WEBP; si el cliente exige PNG por
 * transparencia real, puedes forzar PNG según mimetype.
 */
async function processImageBuffer(buffer, mimetype, { width = 1200 } = {}) {
  const pipeline = sharp(buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true });
  // Elegimos formato de salida
  const isPng = /png$/i.test(mimetype);
  const isJpeg = /jpe?g$/i.test(mimetype);
  const isWebp = /webp$/i.test(mimetype);

  if (isWebp) return pipeline.webp({ quality: 80 }).toBuffer();
  if (isPng) return pipeline.png({ quality: 80 }).toBuffer();
  if (isJpeg) return pipeline.jpeg({ quality: 80 }).toBuffer();
  // Fallback a WEBP para otros formatos (heic, tiff, etc.)
  return pipeline.webp({ quality: 80 }).toBuffer();
}

/**
 * Sube un buffer a Cloudinary usando upload_stream. Devuelve el resultado
 * de Cloudinary (secure_url, public_id, etc.).
 */
function uploadBufferToCloudinary(
  buffer,
  { folder = "uploads", public_id } = {}
) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * Procesa (sharp) + sube (cloudinary) una única imagen desde `file` de multer.
 * Devuelve el objeto result de Cloudinary.
 */
async function processAndUploadFile(
  file,
  { folder, width } = { folder: "uploads", width: 1200 }
) {
  if (!file || !file.buffer) throw new Error("Archivo inválido o sin buffer");
  const processed = await processImageBuffer(file.buffer, file.mimetype, {
    width,
  });
  const safeBase = (file.originalname || "image")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");
  const public_id = `${Date.now()}-${safeBase}`.replace(
    /\.(png|jpe?g|webp|gif|heic|tiff)$/i,
    ""
  );
  return uploadBufferToCloudinary(processed, { folder, public_id });
}

/* ─────────────────────────────────────────────────────────
 *  Negocios: imageProcessor
 *  - Lee req.files (buffers) y escribe URLs en req.body
 * ───────────────────────────────────────────────────────── */
export const imageProcessor = async (req, res, next) => {
  try {
    const files = req.files || {};
    req._uploadedByFile = req._uploadedByFile || {};

    // FEATURED (portada)
    if (files?.featuredImage?.[0]) {
      const result = await processAndUploadFile(files.featuredImage[0], {
        folder: "negocios/featured",
        width: 1600,
      });
      req.body.featuredImage = result.secure_url;
      req._uploadedByFile.featuredImage = true;
    }

    // PROFILE (avatar)
    if (files?.profileImage?.[0]) {
      const result = await processAndUploadFile(files.profileImage[0], {
        folder: "negocios/profile",
        width: 600,
      });
      req.body.profileImage = result.secure_url;
      req._uploadedByFile.profileImage = true;
    }

    // GALERÍA (múltiples)
    if (files?.images?.length > 0) {
      const uploads = await Promise.all(
        files.images.map((f) =>
          processAndUploadFile(f, { folder: "negocios/galeria", width: 1400 })
            .then((r) => r.secure_url)
            .catch((err) => {
              console.error(
                "❌ Error subiendo imagen de galería:",
                err?.message || err
              );
              return null;
            })
        )
      );
      const prev = Array.isArray(req.body.images) ? req.body.images : [];
      req.body.images = [...prev, ...uploads.filter(Boolean)];
      req._uploadedByFile.gallery = true;
    }

    return next();
  } catch (error) {
    console.error("🛑 Error en imageProcessor:", {
      message: error?.message,
      cloudinary: error?.response?.data || "Sin respuesta de Cloudinary",
    });
    return res.status(500).json({ msg: "Error al procesar imágenes" });
  }
};

/* ─────────────────────────────────────────────────────────
 *  Subida de una sola imagen de perfil (endpoint dedicado)
 * ───────────────────────────────────────────────────────── */
export const singleProfileImageUpload = upload.single("profileImage");

export const handleProfileImage = async (req, res, next) => {
  try {
    if (req.file) {
      const result = await processAndUploadFile(req.file, {
        folder: "perfiles",
        width: 600,
      });
      req.body.profileImage = result.secure_url;
      req._uploadedByFile = req._uploadedByFile || {};
      req._uploadedByFile.profileImage = true;
    }
    return next();
  } catch (error) {
    console.error("❌ Error al subir imagen de perfil:", error);
    return res.status(500).json({ msg: "Error en imagen de perfil" });
  }
};

/* ─────────────────────────────────────────────────────────
 *  Comunidades: uploader + procesador
 *  - Mantiene upload.any() por flexibilidad (foodImages y variantes)
 * ───────────────────────────────────────────────────────── */
export const uploadCommunityImages = upload.any();

function normalizeFiles(req) {
  if (Array.isArray(req.files)) {
    const map = {};
    for (const f of req.files) {
      (map[f.fieldname] ||= []).push(f);
    }
    return map;
  }
  return req.files || {};
}

export const processCommunityImages = async (req, res, next) => {
  try {
    req._uploadedByFile = req._uploadedByFile || {};
    req.body = req.body || {};

    const filesByKey = normalizeFiles(req);

    // 1) flagImage
    if (filesByKey?.flagImage?.[0]) {
      const up = await processAndUploadFile(filesByKey.flagImage[0], {
        folder: "communities",
        width: 600,
      });
      req.body.flagImage = up.secure_url;
      req._uploadedByFile.flagImage = true;
    }

    // 2) bannerImage
    if (filesByKey?.bannerImage?.[0]) {
      const up = await processAndUploadFile(filesByKey.bannerImage[0], {
        folder: "communities",
        width: 1800,
      });
      req.body.bannerImage = up.secure_url;
      req._uploadedByFile.bannerImage = true;
    }

    // 3) originCountryFlag -> originCountryInfo.flag
    if (filesByKey?.originCountryFlag?.[0]) {
      const up = await processAndUploadFile(filesByKey.originCountryFlag[0], {
        folder: "communities",
        width: 600,
      });
      req.body.originCountryInfo = {
        ...(req.body.originCountryInfo || {}),
        flag: up.secure_url,
      };
      req._uploadedByFile.originCountryFlag = true;
    }

    // 4A) foodImages (misma key repetida)
    if (
      Array.isArray(filesByKey?.foodImages) &&
      filesByKey.foodImages.length > 0
    ) {
      if (!Array.isArray(req.body.food)) req.body.food = [];
      for (let i = 0; i < filesByKey.foodImages.length; i++) {
        const up = await processAndUploadFile(filesByKey.foodImages[i], {
          folder: "communities",
          width: 1200,
        });
        req.body.food[i] = {
          ...(req.body.food[i] || {}),
          image: up.secure_url,
        };
        req._uploadedByFile[`foodImages_${i}`] = true;
      }
    }

    // 4B) foodImages con índices: foodImages[0], foodImages[1], ...
    const bracketedKeys = Object.keys(filesByKey).filter((k) =>
      /^(foodImages|food)\[\d+\]$/.test(k)
    );
    if (bracketedKeys.length > 0) {
      if (!Array.isArray(req.body.food)) req.body.food = [];
      bracketedKeys.sort((a, b) => {
        const ai = parseInt(a.match(/\[(\d+)\]/)[1], 10);
        const bi = parseInt(b.match(/\[(\d+)\]/)[1], 10);
        return ai - bi;
      });
      for (const k of bracketedKeys) {
        const idx = parseInt(k.match(/\[(\d+)\]/)[1], 10);
        const file = filesByKey[k][0];
        const up = await processAndUploadFile(file, {
          folder: "communities",
          width: 1200,
        });
        req.body.food[idx] = {
          ...(req.body.food[idx] || {}),
          image: up.secure_url,
        };
        req._uploadedByFile[`foodImages_${idx}`] = true;
      }
    }

    // Debug opcional
    console.log("[img] body.flagImage:", req.body.flagImage);
    console.log("[img] body.bannerImage:", req.body.bannerImage);
    console.log(
      "[img] body.originCountryInfo?.flag:",
      req.body.originCountryInfo?.flag
    );
    console.log(
      "[img] body.food.len:",
      Array.isArray(req.body.food) ? req.body.food.length : 0
    );

    return next();
  } catch (err) {
    console.error("❌ Error en processCommunityImages:", err);
    return res.status(500).json({ error: "Error al procesar imágenes" });
  }
};
