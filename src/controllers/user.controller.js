import User from '../models/user.model.js';
import { validationResult } from 'express-validator';

// Obtener todos los usuarios (solo admin)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Excluir la contraseña
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor   ' });
  }
};

// Obtener un usuario por ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Actualizar un usuario por ID
export const updateUser = async (req, res) => {
  // Validar los datos de entrada
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, profileImage } = req.body;

  // Solo el propio usuario o un admin puede actualizar
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'No autorizado' });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ msg: 'Usuario no encontrado' });

    // Actualizar campos permitidos
    user.name = name ?? user.name;
    user.profileImage = profileImage ?? user.profileImage;
    user.updatedAt = Date.now();

    const updatedUser = await user.save();

    res.status(200).json({
      msg: 'Usuario actualizado',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        profileImage: updatedUser.profileImage,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
        community: updatedUser.community,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error del servidor' });
  }
};

// Eliminar un usuario por ID (solo admin)
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  // Solo admin puede eliminar usuarios
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
