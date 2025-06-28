import dotenv from "dotenv";
dotenv.config(); // 🟢 Esto carga las variables para este archivo antes de que Cloudinary las necesite

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 📦 Multer (almacenamiento temporal en disco)
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true }); // 🛠️ asegura que crea el árbol si hace falta
}

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
export const upload = multer({ storage });

/* -----------------------------------------------------
   MIDDLEWARES PARA NEGOCIOS Y PERFILES
----------------------------------------------------- */

// Subida de múltiples campos
export const uploaderMiddleware = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "profileImage", maxCount: 1 }, // 🆕
  { name: "images", maxCount: 5 },
]);

// Procesamiento de imágenes para negocios y perfiles
export const imageProcessor = async (req, res, next) => {
  console.log("📦 Archivos recibidos por Multer:", req.files);
  console.log("🔑 Cloudinary config:", {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY?.slice(0, 4) + "***",
  });
  try {
    const files = req.files;

    // Imagen destacada del negocio
    if (files?.featuredImage?.[0]) {
      try {
        console.log("⬆️ Subiendo imagen destacada a Cloudinary...");
        const result = await cloudinary.uploader.upload(
          files.featuredImage[0].path,
          {
            folder: "negocios",
          }
        );
        console.log("✅ Imagen destacada subida:", result.secure_url);
        req.body.featuredImage = result.secure_url;
        await fsp.unlink(files.featuredImage[0].path);
      } catch (err) {
        console.error("❌ Falló subida de imagen destacada:", err);
        throw err;
      }
    }

    // Imagen de perfil del negocio
    if (files?.profileImage?.[0]) {
      const result = await cloudinary.uploader.upload(
        files.profileImage[0].path,
        {
          folder: "perfiles",
        }
      );
      req.body.profileImage = result.secure_url;
      await fsp.unlink(files.profileImage[0].path);
    }

    // Galería de imágenes del negocio
    if (files?.images?.length > 0) {
      console.log(`📸 Subiendo ${files.images.length} imágenes de galería...`);
      const uploads = await Promise.all(
        files.images.map(async (file) => {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "negocios/galeria",
            });
            console.log("✅ Imagen galería subida:", result.secure_url);
            await fsp.unlink(file.path);
            return result.secure_url;
          } catch (err) {
            console.error("❌ Error subiendo imagen de galería:", err);
            throw err;
          }
        })
      );
      req.body.images = uploads;
    }

    next();
  } catch (error) {
    console.error("🛑 Error en imageProcessor:", {
      message: error?.message,
      cloudinary: error?.response?.data || "Sin respuesta de Cloudinary",
    });
    return res.status(500).json({ msg: "Error al procesar imágenes" });
  }
};

// Upload único para imagen de perfil (usuarios)
export const singleProfileImageUpload = upload.single("profileImage");

export const handleProfileImage = async (req, res, next) => {
  try {
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "perfiles",
      });
      req.body.profileImage = result.secure_url;

      // ✅ Eliminar archivo local
      try {
        await fsp.unlink(req.file.path);
        console.log("🧹 Imagen eliminada correctamente");
      } catch (unlinkErr) {
        console.error("⚠️ Error eliminando imagen:", unlinkErr);
      }
    }
    next();
  } catch (error) {
    console.error("❌ Error al subir imagen de perfil:", error);
    res.status(500).json({ msg: "Error en imagen de perfil" });
  }
};

/* -----------------------------------------------------
   MIDDLEWARES PARA COMUNIDADES
----------------------------------------------------- */

export const uploadCommunityImages = upload.any(); // permite cualquier campo de imagen

async function uploadToCloudinary(filePath, folder = "communities") {
  const result = await cloudinary.uploader.upload(filePath, { folder });
  return result;
}

async function deleteTempFile(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (err) {
    console.warn("⚠️ No se pudo borrar archivo temporal:", err.message);
  }
}
// 👇 En processCommunityImages middleware

export const processCommunityImages = async (req, res, next) => {
  try {
    // Procesar flagImage
    if (req.files?.flagImage?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.flagImage[0].path
      );
      req.body.flagImage = uploadResult.secure_url;
      await deleteTempFile(req.files.flagImage[0].path);
    }

    // Procesar bannerImage
    if (req.files?.bannerImage?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.bannerImage[0].path
      );
      req.body.bannerImage = uploadResult.secure_url;
      await deleteTempFile(req.files.bannerImage[0].path);
    }

    // Procesar originCountryInfo.flag si se subió como imagen
    if (req.files?.originCountryFlag?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.originCountryFlag[0].path
      );
      req.body.originCountryInfo = {
        ...req.body.originCountryInfo,
        flag: uploadResult.secure_url,
      };
      await deleteTempFile(req.files.originCountryFlag[0].path);
    }

    // Procesar imágenes de comida: foodImages[0], foodImages[1], etc.
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
        const uploadResult = await uploadToCloudinary(file.path);
        req.body.food[index] = {
          ...(req.body.food[index] || {}),
          image: uploadResult.secure_url,
        };
        await deleteTempFile(file.path);
      }
    }

    next();
  } catch (err) {
    console.error("❌ Error en processCommunityImages:", err);
    res.status(500).json({ error: "Error al procesar imágenes" });
  }
};
