import { verifySession } from "../security/session.js";

/**
 * Require a valid embedded-app session. Derives the merchant from the signed
 * session token (Authorization: Bearer <jwt>) and sets req.store_id.
 *
 * It also FORCES that verified store_id into req.query / req.body / req.params,
 * overwriting anything the client sent. This is the core of tenant isolation:
 * every controller reads store_id from those, so a merchant can never act on
 * another store's id even by tampering with the request.
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

  // Overwrite any client-supplied store_id with the verified one.
  if (req.query && typeof req.query === "object") req.query.store_id = req.store_id;
  if (req.body && typeof req.body === "object") req.body.store_id = req.store_id;
  if (req.params && "store_id" in req.params) req.params.store_id = req.store_id;

  next();
}
