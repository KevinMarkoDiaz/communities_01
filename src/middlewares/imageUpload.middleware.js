import dotenv from "dotenv";
dotenv.config();
import sharp from "sharp";

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

async function resizeImage(inputPath, outputPath, width = 1200) {
  const ext = path.extname(inputPath).toLowerCase();
  const sharpInstance = sharp(inputPath).resize({ width });

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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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
  { name: "images", maxCount: 5 },
]);

async function deleteTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await fsp.unlink(filePath);
    }
  } catch (err) {
    console.warn("⚠️ No se pudo borrar archivo temporal:", err.message);
  }
}

export const imageProcessor = async (req, res, next) => {
  try {
    const files = req.files;

    if (files?.featuredImage?.[0]) {
      try {
        const inputPath = files.featuredImage[0].path;
        const resizedPath = inputPath.replace(/\.(\w+)$/, "-resized.$1");
        await resizeImage(inputPath, resizedPath);

        const result = await cloudinary.uploader.upload(resizedPath, {
          folder: "negocios",
        });
        req.body.featuredImage = result.secure_url;

        await deleteTempFile(inputPath);
        await deleteTempFile(resizedPath);
      } catch (err) {
        console.error("❌ Falló subida de imagen destacada:", err);
        return res.status(500).json({ msg: "Error al subir imagen destacada" });
      }
    }

    if (files?.profileImage?.[0]) {
      const inputPath = files.profileImage[0].path;
      const resizedPath = inputPath.replace(/\.(\w+)$/, "-resized.$1");
      await resizeImage(inputPath, resizedPath);

      const result = await cloudinary.uploader.upload(resizedPath, {
        folder: "perfiles",
      });
      req.body.profileImage = result.secure_url;

      await deleteTempFile(inputPath);
      await deleteTempFile(resizedPath);
    }

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
            console.error("❌ Error subiendo imagen de galería:", err);
            return null;
          }
        })
      );
      req.body.images = uploads.filter(Boolean);
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

      await deleteTempFile(inputPath);
      await deleteTempFile(resizedPath);
    }
    next();
  } catch (error) {
    console.error("❌ Error al subir imagen de perfil:", error);
    res.status(500).json({ msg: "Error en imagen de perfil" });
  }
};

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
    if (req.files?.flagImage?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.flagImage[0].path
      );
      req.body.flagImage = uploadResult.secure_url;
    }

    if (req.files?.bannerImage?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.bannerImage[0].path
      );
      req.body.bannerImage = uploadResult.secure_url;
    }

    if (req.files?.originCountryFlag?.[0]) {
      const uploadResult = await uploadToCloudinary(
        req.files.originCountryFlag[0].path
      );
      req.body.originCountryInfo = {
        ...req.body.originCountryInfo,
        flag: uploadResult.secure_url,
      };
    }

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
      }
    }

    next();
  } catch (err) {
    console.error("❌ Error en processCommunityImages:", err);
    res.status(500).json({ error: "Error al procesar imágenes" });
  }
};
