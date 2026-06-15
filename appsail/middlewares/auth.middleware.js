import { verifySession } from "../security/session.js";

/**
 * Require a valid embedded-app session. Derives the merchant from the signed
 * session token (Authorization: Bearer <jwt>) and sets req.store_id — endpoints
 * MUST scope to req.store_id, never to a client-supplied store_id.
 */
export function requireAuth(req, res, next) {
  const header = String(req.headers["authorization"] || "").trim();
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const payload = match ? verifySession(match[1]) : null;

  if (!payload) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  req.store_id = payload.store_id;
  req.user_id = payload.user_id || null;
  next();
}
