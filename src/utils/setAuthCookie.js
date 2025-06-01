// src/utils/setAuthCookie.js
export function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd, // true en producción
    sameSite: isProd ? "None" : "Lax",
    maxAge: 3600000, // 1h
  });
}
