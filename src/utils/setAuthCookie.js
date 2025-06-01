// src/utils/setAuthCookie.js
export function setAuthCookie(res, token) {

  res.cookie("token", token, {
    httpOnly: true,
    secure: true, // true en producción
    sameSite: "None",
    maxAge: 3600000, // 1h
  });
}
