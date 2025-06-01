import User from '../models/user.model.js';
import { validationResult } from 'express-validator';

// Obtener todos los usuarios (solo admin)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Obtener un usuario por ID con populate completo
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('community') // comunidad principal
      .populate('communities') // si es admin
      .populate('businesses')
      .populate('events')
      .populate('categories');

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Actualizar un usuario por ID (perfil)
export const updateUser = async (req, res) => {
  const errors = validationResult(req); // opcional si usás Zod
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;

  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'No autorizado' });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });

    // Campos permitidos a actualizar
    const {
      name,
      lastName,
      title,
      description,
      profileImage,
      location,
      country,
      community,
    } = req.body;

    if (name) user.name = name;
    if (lastName) user.lastName = lastName;
    if (title) user.title = title;
    if (description) user.description = description;
    if (profileImage) user.profileImage = profileImage;
    if (location) user.location = location;
    if (country) user.country = country;
    if (community) user.community = community;

    user.updatedAt = Date.now();

    const updatedUser = await user.save();

    res.status(200).json({
      msg: 'Usuario actualizado',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        title: updatedUser.title,
        description: updatedUser.description,
        location: updatedUser.location,
        country: updatedUser.country,
        profileImage: updatedUser.profileImage,
        role: updatedUser.role,
        community: updatedUser.community,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Eliminar un usuario (solo admin)
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'No autorizado' });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    res.status(200).json({ msg: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};
