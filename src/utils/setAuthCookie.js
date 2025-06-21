// src/utils/setAuthCookie.js
export function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: true, // 🔐 Necesario para SameSite: 'None'
    sameSite: "None", // ✅ Para permitir que el frontend en otro dominio reciba la cookie
    domain: ".communidades.com", // 🧠 Para que esté disponible en todos los subdominios
    maxAge: 3600000,
  });
}
