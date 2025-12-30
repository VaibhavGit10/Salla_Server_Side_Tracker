import { normalizeEvent } from "../pipeline/normalizer.js";
import { verifyWebhookSignature } from "../security/signature.js";
import { saveEvent, findByExternalId } from "../datastore/events.repo.js";
import { dispatchGa4Event } from "../pipeline/ga4.dispatcher.js";

import {
  upsertStoreAuth,
  markStoreInstalled,
  markStoreUninstalled,
  getStore
} from "../datastore/stores.repo.js";

export async function handleSallaWebhook(req, res) {
  try {
    // 1) Signature verification (recommended)
    const signatureHeader =
      process.env.SALLA_WEBHOOK_SIGNATURE_HEADER || "X-Salla-Signature";

    const signature = req.headers[signatureHeader.toLowerCase()];
    const secret = process.env.SALLA_WEBHOOK_SECRET;

    const isValid = verifyWebhookSignature({
      rawBody: req.rawBody,
      signature,
      secret
    });

    if (!isValid) return res.status(401).json({ error: "Invalid signature" });

    // 2) Event routing (Salla uses `event`)
    const eventType = req.body?.event;

    // A) app.store.authorize (Easy Mode production token delivery)
    if (eventType === "app.store.authorize") {
      await upsertStoreAuth(req, req.body);
      return res.json({ received: true, handled: "app.store.authorize" });
    }

    // B) app installed
    if (eventType === "app.installed") {
      await markStoreInstalled(req, req.body);
      return res.json({ received: true, handled: "app.installed" });
    }

    // C) uninstall
    if (eventType === "app.uninstalled" || eventType === "app.store.uninstalled") {
      await markStoreUninstalled(req, req.body);
      return res.json({ received: true, handled: "app.uninstalled" });
    }

    // 3) Normal data events: Orders lifecycle etc.
    const event = normalizeEvent(req.body);

    if (!event.store_id || !event.type) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Tenant gating: only allow active stores
    const store = await getStore(req, event.store_id);
    if (!store || store.status === "uninstalled") {
      return res.status(403).json({ error: "Store not active" });
    }

    // Idempotency: dedupe
    const existing = await findByExternalId(
      req,
      event.store_id,
      event.external_id,
      event.type
    );

    if (existing) return res.json({ received: true, deduplicated: true });

    // Save + dispatch async
    const saved = await saveEvent(req, event);

    dispatchGa4Event(req, event, saved.ROWID).catch((err) => {
      console.error("GA4 dispatch failed:", err?.message || err);
    });

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook failure:", err?.message || err);
    return res.status(500).json({ error: "Webhook failed" });
  }
}
