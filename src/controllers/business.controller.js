import { validationResult } from 'express-validator';
import Business from '../models/business.model.js';
import Community from '../models/community.model.js';

/**
 * Crea un nuevo negocio dentro de una comunidad.
 * Solo los administradores o propietarios de negocios pueden crear negocios.
 */
export const createBusiness = async (req, res) => {
  const errors = validationResult(req);
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
    isVerified,
  } = req.body;

  try {
    if (!['admin', 'business_owner'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Acceso denegado. No tienes permisos para crear un negocio.' });
    }

    const communityDoc = await Community.findById(community);
    if (!communityDoc) {
      return res.status(404).json({ msg: 'Comunidad no encontrada.' });
    }

    const newBusiness = new Business({
      name,
      description,
      category,
      community,
      location,
      contact,
      openingHours,
      images,
      isVerified,
      owner: req.user.id,
    });

    await newBusiness.save();

    res.status(201).json({
      msg: 'Negocio creado exitosamente.',
      business: newBusiness,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error en la creación del negocio.' });
  }
};

/**
 * Obtiene todos los negocios.
 */
export const getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find(); // Buscar todos los negocios

    // Responder con los negocios
    res.status(200).json({ businesses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener los negocios.' });
  }
};

/**
 * Obtiene un negocio específico por su ID.
 */
export const getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id); // Buscar negocio por ID

    // Verificar si el negocio existe
    if (!business) {
      return res.status(404).json({ msg: 'Negocio no encontrado.' });
    }

    // Responder con los datos del negocio
    res.status(200).json({ business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener el negocio.' });
  }
};

/**
 * Actualiza un negocio específico.
 * Solo el propietario del negocio o un administrador puede actualizarlo.
 */
export const updateBusiness = async (req, res) => {
  // Validar los datos de entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description } = req.body;

  try {
    const business = await Business.findById(req.params.id); // Buscar negocio por ID

    // Verificar si el negocio existe
    if (!business) {
      return res.status(404).json({ msg: 'Negocio no encontrado.' });
    }

    // Verificar si el usuario tiene permisos para editar el negocio
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para editar este negocio.' });
    }

    // Actualizar los campos del negocio
    business.name = name || business.name;
    business.description = description || business.description;

    // Guardar los cambios
    await business.save();

    // Responder con éxito
    res.status(200).json({
      msg: 'Negocio actualizado exitosamente.',
      business,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al actualizar el negocio.' });
  }
};

/**
 * Elimina un negocio.
 * Solo el propietario del negocio o un administrador puede eliminarlo.
 */
export const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id); // Buscar negocio por ID

    // Verificar si el negocio existe
    if (!business) {
      return res.status(404).json({ msg: 'Negocio no encontrado.' });
    }

    // Verificar si el usuario tiene permisos para eliminar el negocio
    if (business.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'No tienes permisos para eliminar este negocio.' });
    }

    // Eliminar el negocio
    await business.deleteOne();  // Cambié remove() por deleteOne()

    // Responder con éxito
    res.status(200).json({ msg: 'Negocio eliminado exitosamente.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al eliminar el negocio.' });
  }
};
