import { introspectEmbeddedToken } from "../services/salla.service.js";
import { signSession } from "../security/session.js";
import { getStore } from "../datastore/stores.repo.js";

/**
 * POST /auth/embedded
 * Body: { token }  — the short-lived Salla embedded token (em_tok_…) from
 * embedded.auth.getToken() in the iframe.
 *
 * Verifies it with Salla's Introspection API, then mints our own session token
 * bound to the verified store_id and returns it. The client stores this and
 * sends it as Authorization: Bearer on every subsequent request.
 */
export async function embeddedLogin(req, res) {
  try {
    const token = req.body?.token;
    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

    const { store_id, user_id } = await introspectEmbeddedToken(token);

    const session = signSession({ store_id, user_id });
    return res.json({ ok: true, token: session, store_id });
  } catch (err) {
    const status = err?.response?.status;
    console.error("Embedded login failed:", { status, message: err?.message });
    return res.status(401).json({ ok: false, error: "Invalid or expired embedded token" });
  }
}

/**
 * GET /auth/me  (requires auth)
 * Returns the authenticated merchant's store, scoped to req.store_id.
 */
export async function me(req, res) {
  try {
    const store = await getStore(req, req.store_id);
    return res.json({
      ok: true,
      data: {
        store_id: req.store_id,
        store_name: store?.store_name || null,
        status: store?.status || null
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to load session" });
  }
}
