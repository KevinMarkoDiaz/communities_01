import { validationResult } from "express-validator"; // Omitir si usás Zod
import Business from "../models/business.model.js";
import Community from "../models/community.model.js";
import { geocodeAddress } from "../utils/geocode.js"; // al inicio
/**
 * Crear un nuevo negocio
 */
export const createBusiness = async (req, res) => {
  try {
    if (!["admin", "business_owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear un negocio." });
    }

    // 🔍 Parsear campos que vienen como string JSON desde FormData
    let {
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

    try {
      if (typeof location === "string") location = JSON.parse(location);
      if (typeof contact === "string") contact = JSON.parse(contact);
      if (typeof openingHours === "string")
        openingHours = JSON.parse(openingHours);
      if (typeof tags === "string") tags = JSON.parse(tags);
    } catch (err) {
      console.error("❌ Error al parsear campos JSON:", err);
      return res
        .status(400)
        .json({ msg: "Formato inválido en los datos enviados." });
    }

    const communityDoc = await Community.findById(community);
    if (!communityDoc) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    // 🧭 Obtener coordenadas desde dirección
    const fullAddress = `${location.address}, ${location.city}, ${
      location.state
    }, ${location.country || "USA"}`;
    const coordinates = await geocodeAddress(fullAddress);
    location.coordinates = coordinates;

    const featuredImageUrl = req.body.featuredImage || "";
    const profileImageUrl = req.body.profileImage || "";
    const galleryUrls = req.body.images || [];

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
      profileImage: profileImageUrl, // 🆕 logo o avatar del negocio
      images: galleryUrls,
    });

    await newBusiness.save();

    const populatedBusiness = await Business.findById(newBusiness._id)
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(201).json({
      msg: "Negocio creado exitosamente.",
      business: populatedBusiness,
    });
  } catch (error) {
    console.error("❌ Error en createBusiness:", error);
    res.status(500).json({ msg: "Error al crear el negocio." });
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
    res.status(500).json({ msg: "Error al obtener los negocios." });
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
      return res.status(404).json({ msg: "Negocio no encontrado." });
    }

    res.status(200).json({ business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el negocio." });
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

  let {
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

  // 🧠 Parsear campos JSON si vienen como strings (por FormData)
  try {
    if (typeof location === "string") location = JSON.parse(location);
    if (typeof contact === "string") contact = JSON.parse(contact);
    if (typeof openingHours === "string")
      openingHours = JSON.parse(openingHours);
    if (typeof tags === "string") tags = JSON.parse(tags);
    if (typeof images === "string") images = JSON.parse(images);
  } catch (err) {
    console.error("❌ Error al parsear campos JSON:", err);
    return res
      .status(400)
      .json({ msg: "Formato inválido en los datos enviados." });
  }

  // 🌍 Si hay nueva dirección, obtener coordenadas
  if (location?.address && location?.city && location?.state) {
    try {
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      const coords = await geocodeAddress(fullAddress);
      location.coordinates = coords;
    } catch (err) {
      console.error("❌ Error al geocodificar:", err);
      return res.status(400).json({
        msg: "No se pudo obtener coordenadas para la nueva dirección.",
      });
    }
  }

  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ msg: "Negocio no encontrado." });
    }

    const esPropietario = business.owner.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";
    if (!esPropietario && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para actualizar este negocio." });
    }

    if (owner && owner !== business.owner.toString()) {
      return res
        .status(400)
        .json({ msg: "No puedes cambiar el propietario del negocio." });
    }

    // ✅ Imagen destacada: nuevo archivo o URL existente
    if (req.files?.featuredImage?.[0]) {
      featuredImage = req.body.featuredImage;
    } else if (req.body.featuredImageUrl) {
      featuredImage = req.body.featuredImageUrl;
    }

    // ✅ Imagen de perfil: nuevo archivo o URL existente
    if (req.files?.profileImage?.[0]) {
      profileImage = req.body.profileImage;
    } else if (req.body.profileImageUrl) {
      profileImage = req.body.profileImageUrl;
    }

    // ✅ Galería: nuevos archivos ya procesados o URLs anteriores
    if (req.files?.images?.length) {
      // Se mantiene el campo `images` recibido como string o array ya parseado
    } else if (req.body.existingImages) {
      try {
        images = JSON.parse(req.body.existingImages);
      } catch (err) {
        console.warn("❗Error al parsear existingImages:", err);
        images = [];
      }
    }

    // 🛠️ Actualizar campos permitidos
    if (name) business.name = name;
    if (description) business.description = description;
    if (category) business.category = category;
    if (community) business.community = community;
    if (location) business.location = location;
    if (contact) business.contact = contact;
    if (openingHours) business.openingHours = openingHours;
    if (tags) business.tags = tags;
    if (typeof isVerified === "boolean") business.isVerified = isVerified;
    if (featuredImage) business.featuredImage = featuredImage;
    if (profileImage) business.profileImage = profileImage;
    if (images) business.images = images;

    await business.save();

    const populated = await Business.findById(business._id)
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(200).json({
      msg: "Negocio actualizado exitosamente.",
      business: populated,
    });
  } catch (error) {
    console.error("❌ Error en updateBusiness:", error);
    res.status(500).json({ msg: "Error al actualizar el negocio." });
  }
};

/**
 * Eliminar un negocio
 */

export const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ msg: "Negocio no encontrado." });
    }

    const esPropietario = business.owner.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";
    if (!esPropietario && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar este negocio." });
    }

    await business.deleteOne();

    res.status(200).json({ msg: "Negocio eliminado exitosamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar el negocio." });
  }
};

/**
 * Obtener todos los negocios creados por el usuario autenticado
 */

export const getMyBusinesses = async (req, res) => {
  try {
    if (!["admin", "business_owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para ver tus negocios." });
    }

    const businesses = await Business.find({ owner: req.user.id })
      .populate("category")
      .populate("community")
      .populate("owner");

    res.status(200).json({ businesses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener tus negocios." });
  }
};

export const getPromotionsByBusiness = async (req, res) => {
  try {
    const { id } = req.params;

    const negocio = await Business.findById(id)
      .populate({
        path: "promotions",
        populate: [
          { path: "category", select: "name" },
          { path: "community", select: "name" },
        ],
      })
      .select("name promotions");

    if (!negocio) {
      return res.status(404).json({ msg: "Negocio no encontrado" });
    }

    console.log("🔎 Promociones del negocio:", negocio.promotions);

    res.json({ promotions: negocio.promotions });
  } catch (error) {
    console.error("❌ Error al obtener promociones del negocio:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};
