import { normalizeEvent } from "../pipeline/normalizer.js";
import { verifyWebhookSignature } from "../security/signature.js";

import { saveEvent, findByExternalId } from "../datastore/events.repo.js";
import {
  upsertStoreAuth,
  markStoreInstalled,
  markStoreUninstalled,
  getStore
} from "../datastore/stores.repo.js";

import { dispatchGa4Event } from "../pipeline/ga4.dispatcher.js";

/**
 * Salla can send signature in different ways:
 * - X-Salla-Signature: <hex>
 * - X-Salla-Signature: sha256=<hex>
 * - Authorization: Bearer <hex>
 *
 * We prefer X-Salla-Signature. If not present, we only accept Authorization
 * if it looks like a sha256 hex signature (64 hex chars).
 */
function extractSallaSignature(req) {
  const xSig = req.headers["x-salla-signature"];
  const auth = req.headers["authorization"];

  // Prefer explicit signature header
  let raw = xSig ?? auth ?? "";
  raw = String(raw).trim();

  // Strip common prefixes
  raw = raw.replace(/^Bearer\s+/i, "").trim();
  raw = raw.replace(/^sha256=/i, "").trim();

  // If we are using Authorization fallback, ensure it REALLY is a signature
  // (avoid picking some other Authorization token)
  if (!xSig) {
    const isHex64 = /^[a-f0-9]{64}$/i.test(raw);
    if (!isHex64) return "";
  }

  return raw;
}

export async function handleSallaWebhook(req, res) {
  try {
    // 1) Verify signature
    const signature = extractSallaSignature(req);
    const secret = process.env.SALLA_WEBHOOK_SECRET;

    

    const isValid = verifyWebhookSignature({
      rawBody: req.rawBody, // IMPORTANT: must be the original raw body (Buffer/string)
      signature,
      secret
    });

    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 2) Route app lifecycle events first
    const eventType = String(req.body?.event || "").trim();

    if (eventType === "app.store.authorize") {
      await upsertStoreAuth(req, req.body);
      return res.json({ received: true, handled: "app.store.authorize" });
    }

    if (eventType === "app.installed" || eventType === "app.updated") {
      await markStoreInstalled(req, req.body);
      return res.json({ received: true, handled: eventType });
    }

    if (eventType === "app.uninstalled" || eventType === "app.store.uninstalled") {
      await markStoreUninstalled(req, req.body);
      return res.json({ received: true, handled: eventType });
    }

    // 3) Data events → normalize
    const event = normalizeEvent(req.body);

    if (!event.store_id || !event.type) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // 4) Tenant gating (auto-create store row if missing)
    let store = await getStore(req, event.store_id);

    if (!store) {
      // Create minimal store row so we don't 403 while authorize is pending
      await markStoreInstalled(req, event.store_id);
      store = await getStore(req, event.store_id);
    }

    if (!store || String(store.status || "").toLowerCase() === "uninstalled") {
      return res.status(403).json({
        error: "Store not active",
        status: store?.status || null
      });
    }

    // 5) Idempotency (dedupe key is: store_id + external_id + type)
    const existing = await findByExternalId(
      req,
      event.store_id,
      event.external_id,
      event.type
    );

    if (existing) {
      return res.json({ received: true, deduplicated: true });
    }

    // 6) Save + async dispatch
    const saved = await saveEvent(req, event);

    dispatchGa4Event(req, event, saved.ROWID).catch((err) => {
      console.error("GA4 dispatch failed:", err?.message || err);
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook failure:", err);

    return res.status(500).json({
      error: "Webhook failed",
      message: err?.message,
      stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined
    });
  }
}
