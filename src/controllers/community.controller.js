import slugify from "slugify";
import { validationResult } from "express-validator";
import Community from "../models/community.model.js";

/**
 * Crea una nueva comunidad.
 * Solo los administradores o propietarios de negocios pueden crear comunidades.
 */
export const createCommunity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!["admin", "business_owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear comunidades." });
    }

    const data = req.body.data ? JSON.parse(req.body.data) : req.body;

    const {
      name,
      description,
      flagImage,
      bannerImage,
      language,
      tipo,
      populationEstimate,
      originCountryInfo,
      traditions,
      food,
      resources,
      socialMediaLinks,
      region,
      mapCenter,
      metaTitle,
      metaDescription,
    } = data;

    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
      return res
        .status(400)
        .json({ msg: "Ya existe una comunidad con ese nombre." });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const newCommunity = new Community({
      name,
      slug,
      description,
      flagImage,
      bannerImage,
      language,
      tipo,
      owner: req.user.id,
      populationEstimate,
      originCountryInfo,
      traditions,
      food,
      resources,
      socialMediaLinks,
      region,
      mapCenter,
      metaTitle,
      metaDescription,
      status: "Publicada",
      verified: false,
    });

    await newCommunity.save();

    res.status(201).json({
      msg: "Comunidad creada exitosamente.",
      community: newCommunity,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error en la creación de la comunidad." });
  }
};

/**
 * Obtiene todas las comunidades.
 */
export const getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find().populate("owner", "name email");
    res.status(200).json({ communities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener las comunidades." });
  }
};

/**
 * Obtiene una comunidad específica por su ID.
 */
export const getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate("owner", "name email role profileImage")
      .populate("negocios", "name category location images")
      .populate("eventos", "title startDate endDate imagenDestacada");

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    res.status(200).json({ community });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener la comunidad." });
  }
};

/**
 * Actualiza una comunidad específica.
 */
export const updateCommunity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { name } = data;

    let community = await Community.findById(req.params.id);
    if (!community && typeof req.params.id === "string") {
      community = await Community.findOne({ slug: req.params.id });
    }
    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    if (
      community.owner.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para editar esta comunidad." });
    }

    if (name && name !== community.name) {
      const exists = await Community.findOne({ name });
      if (exists) {
        return res
          .status(400)
          .json({ msg: "Ya existe una comunidad con ese nombre." });
      }
      community.name = name;
      community.slug = slugify(name, { lower: true, strict: true });
    }

    // Actualizar campos si están presentes
    const camposActualizables = [
      "description",
      "flagImage",
      "bannerImage",
      "language",
      "tipo",
      "populationEstimate",
      "originCountryInfo",
      "traditions",
      "food",
      "resources",
      "socialMediaLinks",
      "region",
      "mapCenter",
      "metaTitle",
      "metaDescription",
      "status",
      "verified",
    ];

    camposActualizables.forEach((campo) => {
      if (data[campo] !== undefined) {
        community[campo] = data[campo];
      }
    });

    await community.save();

    res
      .status(200)
      .json({ msg: "Comunidad actualizada exitosamente.", community });
  } catch (error) {
    console.error("❌ Error al actualizar comunidad:", error);
    res.status(500).json({ msg: "Error al actualizar la comunidad." });
  }
};

/**
 * Elimina una comunidad.
 */
export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    if (
      community.owner.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar esta comunidad." });
    }

    await community.deleteOne();
    res.status(200).json({ msg: "Comunidad eliminada exitosamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar la comunidad." });
  }
};

/**
 * Obtiene las comunidades del usuario autenticado.
 */
export const getMyCommunities = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { owner: req.user.id };
    const communities = await Community.find(query);
    res.status(200).json({ communities });
  } catch (error) {
    console.error("Error al obtener comunidades del usuario:", error);
    res.status(500).json({ msg: "Error al obtener comunidades." });
  }
};

/**
 * Obtiene una comunidad pública a través del `slug`.
 * Incluye negocios, eventos y datos del owner.
 */
export const getCommunityBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const community = await Community.findOne({ slug })
      .populate("owner", "name email role profileImage")
      .populate("negocios", "name category location images")
      .populate("eventos", "title startDate endDate imagenDestacada");

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    res.status(200).json({ community });
  } catch (error) {
    console.error("❌ Error al obtener comunidad por slug:", error);
    res.status(500).json({ msg: "Error al buscar comunidad por slug." });
  }
};
