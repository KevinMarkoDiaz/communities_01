// src/utils/setAuthCookie.js
export function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    domain: ".communidades.com",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días
  });
}
