import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ msg: 'No autorizado. Token faltante' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ msg: 'Token inválido o expirado' });
      }

      req.user = decoded.user; // contiene { id, role }
      next();
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error en la autenticación' });
  }
};
