import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    // Leer token de cookie o header Authorization Bearer
    const token =
      req.cookies?.token ||
      (req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer ') &&
        req.headers.authorization.split(' ')[1]);

    if (!token) {
      return res.status(401).json({ msg: 'No autorizado. Token faltante' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ msg: 'Token inválido o expirado' });
      }

      req.user = decoded.user; // Aquí esperas { id, role }
      next();
    });
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({ msg: 'Error en la autenticación' });
  }
};
