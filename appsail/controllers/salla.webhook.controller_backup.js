import { normalizeEvent } from "../pipeline/normalizer.js";
import { verifyWebhookSignature } from "../security/signature.js";

import { saveEvent, findByExternalId } from "../datastore/events.repo.js";
import { upsertStoreAuth, markStoreInstalled, markStoreUninstalled, getStore } from "../datastore/stores.repo.js";

import { dispatchGa4Event } from "../pipeline/ga4.dispatcher.js";

export async function handleSallaWebhook(req, res) {
  try {
    // ---- 1) Verify signature (Salla docs)
    const signatureHeader =
      process.env.SALLA_WEBHOOK_SIGNATURE_HEADER || "x-salla-signature";

    const signature = req.headers[signatureHeader.toLowerCase()];
    const secret = process.env.SALLA_WEBHOOK_SECRET;

    const isValid = verifyWebhookSignature({
      rawBody: req.rawBody,
      signature,
      secret
    });

    if (!isValid) return res.status(401).json({ error: "Invalid signature" });

    // ---- 2) Route based on Salla event
    const eventType = req.body?.event;

    // A) App authorization event (Easy Mode = production)
    if (eventType === "app.store.authorize") {
      // Payload per Salla: merchant + data.access_token/refresh_token/expires/scopes :contentReference[oaicite:5]{index=5}
      await upsertStoreAuth(req, req.body);
      return res.json({ received: true, handled: "app.store.authorize" });
    }

    // B) App lifecycle events
    if (eventType === "app.installed") {
      await markStoreInstalled(req, req.body);
      return res.json({ received: true, handled: "app.installed" });
    }

    if (eventType === "app.uninstalled") {
      await markStoreUninstalled(req, req.body);
      return res.json({ received: true, handled: "app.uninstalled" });
    }

    // C) Store events (Orders, etc) → pipeline
    const event = normalizeEvent(req.body);

    if (!event.store_id || !event.type) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const existing = await findByExternalId(req, event.store_id, event.external_id, event.type);
    if (existing) return res.json({ received: true, deduplicated: true });

    const saved = await saveEvent(req, event);

    // Non-blocking dispatch
    dispatchGa4Event(req, event, saved.ROWID).catch((err) => {
      console.error("GA4 dispatch failed:", err.message);
    });

    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook failure:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
}
