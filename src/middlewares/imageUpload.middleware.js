// middlewares/imageUpload.middleware.js
import dotenv from "dotenv";
dotenv.config();

import sharp from "sharp";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

/* ─────────────────────────────────────────────────────────
 *  Helpers de imagen: resize + corrección de orientación
 *  (rotate() usa metadata EXIF para evitar fotos “de lado”)
 * ───────────────────────────────────────────────────────── */
async function resizeImage(inputPath, outputPath, width = 1200) {
  const ext = path.extname(inputPath).toLowerCase();
  const sharpInstance = sharp(inputPath).rotate().resize({ width });

  if (ext === ".jpg" || ext === ".jpeg") {
    await sharpInstance.jpeg({ quality: 80 }).toFile(outputPath);
  } else if (ext === ".png") {
    await sharpInstance.png({ quality: 80 }).toFile(outputPath);
  } else if (ext === ".webp") {
    await sharpInstance.webp({ quality: 80 }).toFile(outputPath);
  } else {
    await sharpInstance.toFile(outputPath);
  }
}

/* ─────────────────────────────────────────────────────────
 *  Cloudinary config
 * ───────────────────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ─────────────────────────────────────────────────────────
 *  Carpeta /uploads (diskStorage)
 * ───────────────────────────────────────────────────────── */
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ─────────────────────────────────────────────────────────
 *  Multer (diskStorage)
 * ───────────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const safeName = file.originalname
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "");
    cb(null, Date.now() + "-" + safeName);
  },
});

export const upload = multer({ storage });

export const uploaderMiddleware = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
  { name: "images", maxCount: 20 },
]);

/* ─────────────────────────────────────────────────────────
 *  Borrado robusto con reintentos (EPERM / EBUSY en Windows)
 * ───────────────────────────────────────────────────────── */
async function safeUnlink(filePath, { retries = 5, baseDelayMs = 150 } = {}) {
  if (!filePath) return false;
  for (let i = 0; i < retries; i++) {
    try {
      await fsp.access(filePath).catch(() => {
        throw { code: "ENOENT" };
      });
      await fsp.unlink(filePath);
      return true;
    } catch (err) {
      if (err?.code === "ENOENT") return true; // ya no existe
      if (err?.code === "EPERM" || err?.code === "EBUSY") {
        const wait = baseDelayMs * (i + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      console.warn(
        "⚠️ No se pudo borrar archivo temporal:",
        err?.message || err
      );
      return false;
    }
  }
  console.warn(
    "⚠️ No se pudo borrar archivo temporal tras reintentos:",
    filePath
  );
  return false;
}

async function deleteTempFile(filePath) {
  try {
    await safeUnlink(filePath);
  } catch (err) {
    console.warn("⚠️ No se pudo borrar archivo temporal:", err?.message || err);
  }
}

/* ─────────────────────────────────────────────────────────
 *  Procesador de imágenes para Negocios
 *  - Sube portada / perfil / galería si llegaron como FILE
 *  - Deja en req.body las URLs finales (para el controlador)
 *  - Marca req._uploadedByFile.{featuredImage,profileImage,gallery}
 * ───────────────────────────────────────────────────────── */
export const imageProcessor = async (req, res, next) => {
  try {
    const files = req.files;
    // inicializa flags
    req._uploadedByFile = req._uploadedByFile || {};

    // FEATURED (portada)
    if (files?.featuredImage?.[0]) {
      const inputPath = files.featuredImage[0].path;
      const resizedPath = inputPath.replace(/\.(\w+)$/, "-resized.$1");
      await resizeImage(inputPath, resizedPath);

      const result = await cloudinary.uploader.upload(resizedPath, {
        folder: "negocios/featured",
      });

      // Si hay archivo, SIEMPRE sobreescribe con la URL subida
      req.body.featuredImage = result.secure_url;
      req._uploadedByFile.featuredImage = true;

      await deleteTempFile(inputPath);
      await deleteTempFile(resizedPath);
    }
    // Si NO hay file para featuredImage, no toques req.body.featuredImage.
    // (Si venía por URL desde parseDataField, el controlador la verá).

    // PROFILE (avatar/imagen de perfil del negocio)
    if (files?.profileImage?.[0]) {
      const inputPath = files.profileImage[0].path;
      const resizedPath = inputPath.replace(/\.(\w+)$/, "-resized.$1");
      await resizeImage(inputPath, resizedPath);

      const result = await cloudinary.uploader.upload(resizedPath, {
        folder: "negocios/profile",
      });

      req.body.profileImage = result.secure_url;
      req._uploadedByFile.profileImage = true;

      await deleteTempFile(inputPath);
      await deleteTempFile(resizedPath);
    }

    // GALERÍA (múltiples)
    if (files?.images?.length > 0) {
      const uploads = await Promise.all(
        files.images.map(async (file) => {
          try {
            const inputPath = file.path;
            const resizedPath = inputPath.replace(/\.(\w+)$/, "-resized.$1");
            await resizeImage(inputPath, resizedPath);

            const result = await cloudinary.uploader.upload(resizedPath, {
              folder: "negocios/galeria",
            });

            await deleteTempFile(inputPath);
            await deleteTempFile(resizedPath);
            return result.secure_url;
          } catch (err) {
            console.error(
              "❌ Error subiendo imagen de galería:",
              err?.message || err
            );
            return null;
          }
        })
      );

      const prev = Array.isArray(req.body.images) ? req.body.images : [];
      req.body.images = [...prev, ...uploads.filter(Boolean)]; // fusiona con las que vinieran como URL (poco común)
      req._uploadedByFile.gallery = true;
    }

    // Debug útil
    console.log(
      "🧪 imageProcessor.body.featuredImage:",
      req.body.featuredImage
    );
    console.log("🧪 imageProcessor.body.profileImage:", req.body.profileImage);
    console.log(
      "🧪 imageProcessor.body.images count:",
      Array.isArray(req.body.images) ? req.body.images.length : 0
    );

    next();
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
      const inputPath = req.file.path;
      const resizedPath = inputPath.replace(/\.(\w+)$/, "-resized.$1");
      await resizeImage(inputPath, resizedPath);

      const result = await cloudinary.uploader.upload(resizedPath, {
        folder: "perfiles",
      });
      req.body.profileImage = result.secure_url;
      req._uploadedByFile = req._uploadedByFile || {};
      req._uploadedByFile.profileImage = true;

      await deleteTempFile(inputPath);
      await deleteTempFile(resizedPath);
    }
    next();
  } catch (error) {
    console.error("❌ Error al subir imagen de perfil:", error);
    res.status(500).json({ msg: "Error en imagen de perfil" });
  }
};

/* ─────────────────────────────────────────────────────────
 *  Subidas “any” para comunidades (mantengo API)
 * ───────────────────────────────────────────────────────── */
export const uploadCommunityImages = upload.any();

async function uploadToCloudinary(filePath, folder = "communities") {
  const resizedPath = filePath.replace(/\.(\w+)$/, "-resized.$1");
  await resizeImage(filePath, resizedPath);
  const result = await cloudinary.uploader.upload(resizedPath, { folder });
  await deleteTempFile(filePath);
  await deleteTempFile(resizedPath);
  return result;
}

export const processCommunityImages = async (req, res, next) => {
  try {
    // Asegura objeto para flags (por si quieres reaprovechar la misma convención)
    req._uploadedByFile = req._uploadedByFile || {};

    if (req.files?.flagImage?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.flagImage[0].path,
        "communities"
      );
      req.body.flagImage = uploadResult.secure_url;
      req._uploadedByFile.flagImage = true;
    }

    if (req.files?.bannerImage?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.bannerImage[0].path,
        "communities"
      );
      req.body.bannerImage = uploadResult.secure_url;
      req._uploadedByFile.bannerImage = true;
    }

    if (req.files?.originCountryFlag?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.originCountryFlag[0].path,
        "communities"
      );
      req.body.originCountryInfo = {
        ...(req.body.originCountryInfo || {}),
        flag: uploadResult.secure_url,
      };
      req._uploadedByFile.originCountryFlag = true;
    }

    // Mantengo tu lógica de arrays para foodImages[n]
    if (req.files) {
      const foodImages = Object.entries(req.files)
        .filter(([key]) => key.startsWith("foodImages["))
        .sort(([a], [b]) => {
          const ai = parseInt(a.match(/\[(\d+)\]/)?.[1] ?? "0");
          const bi = parseInt(b.match(/\[(\d+)\]/)?.[1] ?? "0");
          return ai - bi;
        });

      if (!Array.isArray(req.body.food)) req.body.food = [];

      for (let [key, fileArr] of foodImages) {
        const index = parseInt(key.match(/\[(\d+)\]/)?.[1] ?? "0");
        const file = fileArr[0];
        const uploadResult = await uploadToCloudinary(file.path, "communities");
        req.body.food[index] = {
          ...(req.body.food[index] || {}),
          image: uploadResult.secure_url,
        };
        req._uploadedByFile[`foodImages_${index}`] = true;
      }
    }

    next();
  } catch (err) {
    console.error("❌ Error en processCommunityImages:", err);
    res.status(500).json({ error: "Error al procesar imágenes" });
  }
};
