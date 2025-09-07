// src/utils/oauthState.js
import jwt from "jsonwebtoken";

const OAUTH_STATE_SECRET =
  process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET; // reusa si no tienes otra

export function signOAuthState(payload = {}) {
  // payload tip: { redirect:"communidades://oauth-callback", nonce: "...", returnTo:"/home" }
  return jwt.sign(payload, OAUTH_STATE_SECRET, { expiresIn: "10m" });
}

export function verifyOAuthState(token) {
  return jwt.verify(token, OAUTH_STATE_SECRET);
}
