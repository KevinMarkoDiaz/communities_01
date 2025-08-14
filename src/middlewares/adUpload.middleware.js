// src/middlewares/adUpload.middleware.js
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import sharp from "sharp";

// ⚠️ Asegúrate de tener cloudinary.config(...) en tu bootstrap (p.ej. src/index.js)

// ─────────────────────────────────────────────────────────
// Carpeta temporal
// ─────────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
async function safeUnlink(p) {
  if (!p) return;
  try {
    await fsp.unlink(p);
  } catch {}
}

async function resize(inputPath, outputPath, width = 1600) {
  const ext = path.extname(inputPath).toLowerCase();
  const s = sharp(inputPath).rotate().resize({ width });
  if (ext === ".jpg" || ext === ".jpeg")
    return s.jpeg({ quality: 80 }).toFile(outputPath);
  if (ext === ".png") return s.png({ quality: 80 }).toFile(outputPath);
  if (ext === ".webp") return s.webp({ quality: 80 }).toFile(outputPath);
  return s.toFile(outputPath);
}

// ─────────────────────────────────────────────────────────
// Multer
// ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_").replace(/[^\w.-]/g, "");
    cb(null, `${Date.now()}-${safe}`);
  },
});

function fileFilter(req, file, cb) {
  if (!/image\/(jpeg|jpg|png|webp|gif)/i.test(file.mimetype)) {
    return cb(new Error("Formato de imagen no soportado"), false);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ─────────────────────────────────────────────────────────
// Multi-imagen (dirección de arte por breakpoint)
// Campos: bannerImage (fallback), bannerDesktop, bannerTablet, bannerMobile
// ─────────────────────────────────────────────────────────
export const uploadAdImages = upload.fields([
  { name: "bannerImage", maxCount: 1 }, // default / fallback
  { name: "bannerDesktop", maxCount: 1 },
  { name: "bannerTablet", maxCount: 1 },
  { name: "bannerMobile", maxCount: 1 },
]);

export const processAdImages = async (req, res, next) => {
  try {
    const map = [
      ["bannerImage", "imageUrl", "ads/default"],
      ["bannerDesktop", "imageDesktopUrl", "ads/desktop"],
      ["bannerTablet", "imageTabletUrl", "ads/tablet"],
      ["bannerMobile", "imageMobileUrl", "ads/mobile"],
    ];

    for (const [field, bodyKey, folder] of map) {
      const file = req.files?.[field]?.[0];
      if (!file) continue;

      const input = file.path;
      const out = input.replace(/\.(\w+)$/, "-resized.$1");

      await resize(input, out, 1600);

      const up = await cloudinary.uploader.upload(out, {
        folder,
        resource_type: "image",
        overwrite: true,
      });

      req.body[bodyKey] = up.secure_url;

      await safeUnlink(input);
      await safeUnlink(out);
    }

    next();
  } catch (e) {
    console.error("❌ Error al subir imágenes de banner:", e);
    res.status(500).json({ msg: "Error al subir imágenes de banner" });
  }
};

// ─────────────────────────────────────────────────────────
// Single image (compat legacy)
// Campo: bannerImage
// Deja info en req.bannerUpload
// ─────────────────────────────────────────────────────────
export const uploadAdImage = upload.single("bannerImage");

export const handleAdImage = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const input = req.file.path;
    const out = input.replace(/\.(\w+)$/, "-resized.$1");

    await resize(input, out, 1600);

    const result = await cloudinary.uploader.upload(out, {
      folder: "ads/banners",
      resource_type: "image",
      overwrite: true,
    });

    req.bannerUpload = {
      imageUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    };

    await safeUnlink(input);
    await safeUnlink(out);
    next();
  } catch (err) {
    console.error("❌ Error subiendo banner:", err);
    res.status(500).json({ msg: "Error al subir el banner" });
  }
};
