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
      await fs.unlink(req.file.path);
    }
    next();
  } catch (error) {
    console.error("Error al subir imagen de perfil:", error);
    res.status(500).json({ msg: "Error en imagen de perfil" });
  }
};

/* -----------------------------------------------------
   MIDDLEWARES PARA COMUNIDADES
----------------------------------------------------- */

export const uploadCommunityImages = upload.fields([
  { name: "flagImage", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
]);

export const processCommunityImages = async (req, res, next) => {
  try {
    const files = req.files;

    // Imagen de bandera
    if (files?.flagImage?.[0]) {
      const result = await cloudinary.uploader.upload(files.flagImage[0].path, {
        folder: "comunidades/banderas",
      });
      req.body.flagImage = result.secure_url;
      await fs.unlink(files.flagImage[0].path);
    }

    // Imagen de banner
    if (files?.bannerImage?.[0]) {
      const result = await cloudinary.uploader.upload(
        files.bannerImage[0].path,
        {
          folder: "comunidades/banner",
        }
      );
      req.body.bannerImage = result.secure_url;
      await fs.unlink(files.bannerImage[0].path);
    }

    next();
  } catch (error) {
    console.error("Error al subir imágenes de comunidad:", error);
    res.status(500).json({ msg: "Error al procesar imágenes de comunidad" });
  }
};
