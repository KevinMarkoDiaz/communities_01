import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import { validationResult } from 'express-validator';
import { createAccessToken } from '../libs/jwt.js';
import { setAuthCookie } from '../utils/setAuthCookie.js';

export const registerUser = async (req, res) => {
  const { name, email, password, role, community, profileImage } = req.body;

  // Validación express-validator (asumo que la usás)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Verificar si ya existe el correo
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: 'El correo electrónico ya está registrado' });
    }

    // No permitir rol admin desde el registro público
    if (role === "admin") {
      return res.status(403).json({ msg: "No tienes permisos para asignar el rol de admin." });
    }

    // Generar hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Preparar datos para nuevo usuario
    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
      profileImage,
      isVerified: false,
    };

    // Asignar community solo si tiene un valor válido no vacío
    if (community && community.trim() !== "") {
      userData.community = community;
    }

    // Crear nuevo usuario
    const newUser = new User(userData);
    await newUser.save();

    // Payload para token JWT
    const payload = {
      user: {
        id: newUser._id,
        role: newUser.role,
      },
    };

    const token = await createAccessToken(payload);

    // Enviar token en cookie segura y respuesta JSON
    setAuthCookie(res, token);
      res.status(201)
      .json({
        msg: "Usuario creado",
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          profileImage: newUser.profileImage,
          isVerified: newUser.isVerified,
          community: newUser.community,
        },
      });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error del servidor');
  }
};


export const loginUser = async (req, res) => {
    const { email, password } = req.body;
  console.log("BODY DEL LOGIN:", req.body);
    // Validar los datos
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    try {
      // Verificar si el usuario existe
      const user = await User.findOne({ email })//.populate("community"); remplazar cuando el modelo de community este creado
      if (!user) {
        return res.status(400).json({ msg: "Correo o contraseña incorrectos" });
      }
  
      // Verificar contraseña
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Correo o contraseña incorrectos" });
      }
  
      // Generar el token
      const payload = {
        user: {
          id: user._id,
          role: user.role,
        },
      };
      const token = await createAccessToken(payload);
  
      // Enviar respuesta con token y datos públicos del usuario
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,//process.env.NODE_ENV === "production", cambiar cuando deploye front
          sameSite: "Lax",
          maxAge: 3600000,
        })
        .status(200)
        .json({
          msg: "Inicio de sesión exitoso",
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            community: user.community,
          },
        });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error del servidor");
    }
};
  
export const logoutUser = (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
    });
  
    res.status(200).json({ message: "Sesión cerrada correctamente" });
};  
  
export const getUserProfile = async (req, res) => {
    // Validar campos (opcional si no hay validaciones en el middleware)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    try {
      // Buscar al usuario autenticado por su ID (req.user lo setea el middleware de auth)
      const user = await User.findById(req.user.id)
      .select("-password"); // Excluye la contraseña
        //.populate("community")
  
      if (!user) {
        return res.status(404).json({ msg: "Usuario no encontrado" });
      }
  
      // Devolver datos públicos del perfil
      res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        community: user.community,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: "Error al obtener el perfil del usuario" });
    }
};