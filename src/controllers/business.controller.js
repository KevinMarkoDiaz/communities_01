import { validationResult } from 'express-validator'; // Omitir si usás Zod
import Business from '../models/business.model.js';
import Community from '../models/community.model.js';
import fs from "fs/promises";
import { v2 as cloudinary } from "cloudinary";
/**
 * Crear un nuevo negocio
 */
export const createBusiness = async (req, res) => {
  try {
    if (!['admin', 'business_owner'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'No tienes permisos para crear un negocio.' });
    }

    const {
      name,
      description,
      category,
      community,
      location,
      contact,
      openingHours,
      tags,
      isVerified,
    } = req.body;

    const communityDoc = await Community.findById(community);
    if (!communityDoc) {
      return res.status(404).json({ msg: 'Comunidad no encontrada.' });
    }

    // 📤 Subir imagen destacada a Cloudinary
    let featuredImageUrl = "";
    if (req.files?.featuredImage?.[0]) {
      const file = req.files.featuredImage[0];
      const result = await cloudinary.uploader.upload(file.path);
      featuredImageUrl = result.secure_url;
      await fs.unlink(file.path); // 🧹 Limpia archivo temporal
    }

    // 📤 Subir galería
    const galleryUrls = [];
    if (req.files?.gallery?.length) {
      for (const file of req.files.gallery) {
        const result = await cloudinary.uploader.upload(file.path);
        galleryUrls.push(result.secure_url);
        await fs.unlink(file.path); // 🧹 Limpia cada archivo
      }
    }

    // 🧠 Crear el documento del negocio
    const newBusiness = new Business({
      name,
      description,
      category,
      community,
      location,
      contact,
      openingHours,
      tags,
      isVerified: isVerified ?? false,
      owner: req.user.id,
      featuredImage: featuredImageUrl,
      images: galleryUrls,
    });

    await newBusiness.save();

    const populatedBusiness = await Business.findById(newBusiness._id)
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(201).json({
      msg: 'Negocio creado exitosamente.',
      business: populatedBusiness,
    });
  } catch (error) {
    console.error("❌ Error en createBusiness:", error);
    res.status(500).json({ msg: 'Error al crear el negocio.' });
  }
};


/**
 * Obtener todos los negocios
 */
export const getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find()
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(200).json({ businesses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener los negocios.' });
  }
};

/**
 * Obtener un negocio por ID
 */
export const getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate("category")
      .populate("community")
      .populate("owner");

    if (!business) {
      return res.status(404).json({ msg: 'Negocio no encontrado.' });
    }

    res.status(200).json({ business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener el negocio.' });
  }
};

/**
 * Actualizar un negocio
 */

export const updateBusiness = async (req, res) => {
  const errors = validationResult(req); // Omitir si usás Zod
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name,
    description,
    category,
    community,
    location,
    contact,
    openingHours,
    images,
    tags,
    isVerified,
    featuredImage,
    profileImage,
    owner, // ⚠️ No se debe actualizar
  } = req.body;

  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ msg: 'Negocio no encontrado.' });
    }

    const esPropietario = business.owner.toString() === req.user.id;
    const esAdmin = req.user.role === 'admin';
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ msg: 'No tienes permisos para actualizar este negocio.' });
    }

    if (owner && owner !== business.owner.toString()) {
      return res.status(400).json({ msg: 'No puedes cambiar el propietario del negocio.' });
    }

    // Actualizar campos permitidos
    if (name) business.name = name;
    if (description) business.description = description;
    if (category) business.category = category;
    if (community) business.community = community;
    if (location) business.location = location;
    if (contact) business.contact = contact;
    if (openingHours) business.openingHours = openingHours;
    if (tags) business.tags = tags;
    if (typeof isVerified === 'boolean') business.isVerified = isVerified;

    // ✅ Nuevos campos de imagen
    if (featuredImage) business.featuredImage = featuredImage;
    if (profileImage) business.profileImage = profileImage;
    if (images) business.images = images;

    await business.save();

    const populated = await Business.findById(business._id)
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(200).json({
      msg: 'Negocio actualizado exitosamente.',
      business: populated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al actualizar el negocio.' });
  }
};

/**
 * Eliminar un negocio
 */

export const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ msg: 'Negocio no encontrado.' });
    }

    const esPropietario = business.owner.toString() === req.user.id;
    const esAdmin = req.user.role === 'admin';
    if (!esPropietario && !esAdmin) {
      return res.status(403).json({ msg: 'No tienes permisos para eliminar este negocio.' });
    }

    await business.deleteOne();

    res.status(200).json({ msg: 'Negocio eliminado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al eliminar el negocio.' });
  }
};

/**
 * Obtener todos los negocios creados por el usuario autenticado
 */

export const getMyBusinesses = async (req, res) => {
  try {
    if (!['admin', 'business_owner'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'No tienes permisos para ver tus negocios.' });
    }

    const businesses = await Business.find({ owner: req.user.id })
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(200).json({ businesses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener tus negocios.' });
  }
};
