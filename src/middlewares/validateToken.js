import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // 🆕 Preferimos Authorization: Bearer ... en mobile
    const bearer =
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ") &&
      req.headers.authorization.split(" ")[1];

    // const cookieToken = req.cookies?.token; // ← ❌ (Mobile) No dependas de cookie

    const token = bearer; /*|| cookieToken*/ // ← 🆕 usa header; cookie queda comentada

    if (!token) {
      return res.status(401).json({ msg: "No autorizado. Token faltante" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ msg: "Token inválido o expirado" });
      }

      // decoded.user = { id, role }
      const user = await User.findById(decoded.user.id);

      if (!user) {
        return res.status(401).json({ msg: "Usuario no encontrado" });
      }

      req.user = user; // user completo; en tus controladores usas req.user.id y funciona
      next();
    });
  } catch (error) {
    console.error("Error en autenticación:", error);
    res.status(500).json({ msg: "Error en la autenticación" });
  }
};
