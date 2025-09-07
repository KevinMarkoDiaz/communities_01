// src/utils/setAuthCookie.js

export function setAuthCookie(res, token) {
  // ❌ (Mobile) No usamos cookies para autenticación en la app nativa
  // Mantén estos bloques solo si este backend también va a servir Web.
  // // ✅ Local (web dev)
  // res.cookie("token", token, {
  //   httpOnly: true,
  //   secure: false,
  //   sameSite: "Lax",
  //   maxAge: 1000 * 60 * 60 * 24 * 7,
  // });
  // // ✅ Producción (web)
  // res.cookie("token", token, {
  //   httpOnly: true,
  //   secure: true,
  //   sameSite: "None",
  //   domain: ".communidades.com",
  //   maxAge: 1000 * 60 * 60 * 24 * 7,
  // });
}
