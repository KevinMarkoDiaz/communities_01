export const hasRole = (...roles) => {
  return (req, res, next) => {
    // Verificar si el usuario está autenticado
    if (!req.user) {
      return res.status(401).json({ msg: 'Usuario no autenticado.' });
    }

    // Verificar si el rol del usuario está en los roles permitidos
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        msg: `Acceso denegado. Rol '${req.user.role}' no tiene permisos. Roles autorizados: ${roles.join(', ')}.`
      });
    }

    // Continuar con el siguiente middleware o controlador
    next();
  };
};
