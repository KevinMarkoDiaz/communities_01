// src/utils/setAuthCookie.js

export function setAuthCookie(res, token) {
  // ✅ Configuración para LOCAL (localhost:5173)
  // res.cookie("token", token, {
  //   httpOnly: true,
  //   secure: false, // En local no usas HTTPS
  //   sameSite: "Lax", // Lax permite navegación normal
  //   // domain: undefined,    // No pongas dominio en local
  //   maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  // });

  // ✅ Configuración para PRODUCCIÓN (communidades.com)
  res.cookie("token", token, {
    httpOnly: true,
    secure: true, // Requiere HTTPS
    sameSite: "None", // Para cross-domain
    domain: ".communidades.com", // Tu dominio
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  });
}
