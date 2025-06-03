import { validationResult } from 'express-validator';
import Community from '../models/community.model.js';

/**
 * Crea una nueva comunidad.
 * Solo los administradores o propietarios de negocios pueden crear comunidades.
 */
export const createCommunity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, flagImage, imagenDestacada, language, tipo } = req.body;

  try {
    if (!['admin', 'business_owner'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Acceso denegado. No tienes permisos para crear comunidades.' });
    }

    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
      return res.status(400).json({ msg: 'Ya existe una comunidad con ese nombre.' });
    }

    const newCommunity = new Community({
      name,
      description,
      flagImage,
      imagenDestacada,
      language,
      tipo,
      owner: req.user.id,
    });

    await newCommunity.save();

    res.status(201).json({
      msg: 'Comunidad creada exitosamente.',
      community: newCommunity,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error en la creación de la comunidad.' });
  }
};

/**
 * Obtiene todas las comunidades.
 */
export const getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find();
    res.status(200).json({ communities });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener las comunidades.' });
  }
};

/**
 * Obtiene una comunidad específica por su ID, incluyendo negocios, eventos y datos del owner.
 */
export const getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
      .populate({ path: "owner", select: "name email role profileImage" })
      .populate({ path: "negocios", select: "name category location images" })
      .populate({ path: "eventos", select: "title startDate endDate imagenDestacada" });

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
 * Solo el propietario de la comunidad o un administrador puede actualizarla.
 */
export const updateCommunity = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, flagImage, imagenDestacada, language, tipo } = req.body;

  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ msg: 'Comunidad no encontrada.' });
    }

    if (community.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para editar esta comunidad.' });
    }

    // Validar si el nombre es nuevo y ya existe
    if (name && name !== community.name) {
      const exists = await Community.findOne({ name });
      if (exists) {
        return res.status(400).json({ msg: 'Ya existe una comunidad con ese nombre.' });
      }
    }

    community.name = name || community.name;
    community.description = description || community.description;
    community.flagImage = flagImage || community.flagImage;
    community.imagenDestacada = imagenDestacada || community.imagenDestacada;
    community.language = language || community.language;
    community.tipo = tipo || community.tipo;

    await community.save();

    res.status(200).json({
      msg: 'Comunidad actualizada exitosamente.',
      community,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al actualizar la comunidad.' });
  }
};

/**
 * Elimina una comunidad.
 * Solo el propietario de la comunidad o un administrador puede eliminarla.
 */
export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ msg: 'Comunidad no encontrada.' });
    }

    if (community.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para eliminar esta comunidad.' });
    }

    await community.deleteOne();
    res.status(200).json({ msg: 'Comunidad eliminada exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al eliminar la comunidad.' });
  }
};

/**
 * Obtiene las comunidades del usuario autenticado.
 * Admin ve todas, otros solo las propias.
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
