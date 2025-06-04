import multer from 'multer';
import fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';

// ⚙️ Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 📦 Multer (almacenamiento temporal en disco)
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
export const upload = multer({ storage });

/* -----------------------------------------------------
   MIDDLEWARES PARA NEGOCIOS Y PERFILES
----------------------------------------------------- */

// Subida de múltiples campos
export const uploaderMiddleware = upload.fields([
  { name: 'featuredImage', maxCount: 1 },
  { name: 'images', maxCount: 5 },
]);

// Procesamiento de imágenes para negocios y perfiles
export const imageProcessor = async (req, res, next) => {
  try {
    const files = req.files;

    // Imagen destacada del negocio
    if (files?.featuredImage?.[0]) {
      const result = await cloudinary.uploader.upload(files.featuredImage[0].path, {
        folder: 'negocios',
      });
      req.body.featuredImage = result.secure_url;
      await fs.unlink(files.featuredImage[0].path);
    }

    // Imagen de perfil del negocio
    if (files?.profileImage?.[0]) {
      const result = await cloudinary.uploader.upload(files.profileImage[0].path, {
        folder: 'perfiles',
      });
      req.body.profileImage = result.secure_url;
      await fs.unlink(files.profileImage[0].path);
    }

    // Galería de imágenes del negocio
    if (files?.images?.length > 0) {
      const uploads = await Promise.all(
        files.images.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'negocios/galeria',
          });
          await fs.unlink(file.path);
          return result.secure_url;
        })
      );
      req.body.images = uploads;
    }

    next();
  } catch (error) {
    console.error('Error al subir imágenes a Cloudinary:', error);
    res.status(500).json({ msg: 'Error al procesar imágenes' });
  }
};

// Upload único para imagen de perfil (usuarios)
export const singleProfileImageUpload = upload.single('profileImage');

export const handleProfileImage = async (req, res, next) => {
  try {
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'perfiles',
      });
      req.body.profileImage = result.secure_url;
      await fs.unlink(req.file.path);
    }
    next();
  } catch (error) {
    console.error('Error al subir imagen de perfil:', error);
    res.status(500).json({ msg: 'Error en imagen de perfil' });
  }
};

/* -----------------------------------------------------
   MIDDLEWARES PARA COMUNIDADES
----------------------------------------------------- */

export const uploadCommunityImages = upload.fields([
  { name: 'flagImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 },
]);

export const processCommunityImages = async (req, res, next) => {
  try {
    const files = req.files;

    // Imagen de bandera
    if (files?.flagImage?.[0]) {
      const result = await cloudinary.uploader.upload(files.flagImage[0].path, {
        folder: 'comunidades/banderas',
      });
      req.body.flagImage = result.secure_url;
      await fs.unlink(files.flagImage[0].path);
    }

    // Imagen de banner
    if (files?.bannerImage?.[0]) {
      const result = await cloudinary.uploader.upload(files.bannerImage[0].path, {
        folder: 'comunidades/banner',
      });
      req.body.bannerImage = result.secure_url;
      await fs.unlink(files.bannerImage[0].path);
    }

    next();
  } catch (error) {
    console.error('Error al subir imágenes de comunidad:', error);
    res.status(500).json({ msg: 'Error al procesar imágenes de comunidad' });
  }
};
