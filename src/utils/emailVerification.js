// src/utils/emailVerification.js
import crypto from "crypto";

const API_BASE_URL = process.env.API_BASE_URL || "https://api.communidades.com";

/** Crea token (crudo), su hash (para guardar) y expiración (24h). */
export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
  return { token, tokenHash, expires };
}

/** Arma el enlace final hacia tu API: /api/auth/verify-email?uid=...&token=... */
export function buildVerificationLink({ uid, token }) {
  const url = new URL("/api/auth/verify-email", API_BASE_URL);
  url.searchParams.set("uid", String(uid));
  url.searchParams.set("token", token);
  return url.toString();
}
