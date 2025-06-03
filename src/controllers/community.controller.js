import { validationResult } from 'express-validator';
import Community from '../models/community.model.js';

/**
 * Crea una nueva comunidad.
 * Solo los administradores o propietarios de negocios pueden crear comunidades.
 */
export const createCommunity = async (req, res) => {
  // Validar los datos de entrada usando express-validator
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, flagImage, language } = req.body;

  try {
    // Verificar si el usuario tiene permisos para crear una comunidad (admin o business_owner)
    if (!['admin', 'business_owner'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Acceso denegado. No tienes permisos para crear comunidades.' });
    }

    // Comprobar si la comunidad ya existe
    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
      return res.status(400).json({ msg: 'Ya existe una comunidad con ese nombre.' });
    }

    // Crear la nueva comunidad
    const newCommunity = new Community({
      name,
      description,
      flagImage,
      language,
      owner: req.user.id, // El propietario será el usuario autenticado
    });

    // Guardar la comunidad en la base de datos
    await newCommunity.save();

    // Responder con éxito
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
    const communities = await Community.find(); // Buscar todas las comunidades

    // Responder con las comunidades
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
      .populate({
        path: "owner",
        select: "name email role profileImage",
      })
      .populate({
        path: "negocios",
        select: "name category location images",
      })
      .populate({
        path: "eventos",
        select: "title startDate endDate imagenDestacada",
      });

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
  // Validar los datos de entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, flagImage, language } = req.body;

  try {
    const community = await Community.findById(req.params.id); // Buscar comunidad por ID

    // Verificar si la comunidad existe
    if (!community) {
      return res.status(404).json({ msg: 'Comunidad no encontrada.' });
    }

    // Verificar si el usuario tiene permisos para editar la comunidad
    if (community.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para editar esta comunidad.' });
    }

    // Actualizar los campos de la comunidad
    community.name = name || community.name;
    community.description = description || community.description;
    community.flagImage = flagImage || community.flagImage;
    community.language = language || community.language;

    // Guardar los cambios
    await community.save();

    // Responder con éxito
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
      const community = await Community.findById(req.params.id); // Buscar comunidad por ID
  
      // Verificar si la comunidad existe
      if (!community) {
        return res.status(404).json({ msg: 'Comunidad no encontrada.' });
      }
  
      // Verificar si el usuario tiene permisos para eliminar la comunidad
      if (community.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'No tienes permisos para eliminar esta comunidad.' });
      }
  
      // Eliminar la comunidad
      await community.deleteOne();  // Cambié remove() por deleteOne()
  
      // Responder con éxito
      res.status(200).json({ msg: '  Comunidad eliminada exitosamente.' });
    } catch (error) {
      console.error(error);
      console.error(error);

      res.status(500).json({ msg: 'Error al    sseliminar la comunidad.' });
    }
  };


export const getMyCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const query = role === "admin" ? {} : { owner: userId };

    const communities = await Community.find(query);
    res.status(200).json({ communities });
  } catch (error) {
    console.error("Error al obtener comunidades del usuario:", error);
    res.status(500).json({ message: "Error al obtener comunidades" });
  }
};
