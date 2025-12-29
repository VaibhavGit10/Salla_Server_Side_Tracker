import { normalizeEvent } from "../pipeline/normalizer.js";
import { verifyWebhookSignature } from "../security/signature.js";
import {
  saveEvent,
  findByExternalId
} from "../datastore/events.repo.js";
import { dispatchGa4Event } from "../pipeline/ga4.dispatcher.js";

export async function handleSallaWebhook(req, res) {
  try {
    const signatureHeader =
      process.env.SALLA_WEBHOOK_SIGNATURE_HEADER || "X-Salla-Signature";

    const signature = req.headers[signatureHeader.toLowerCase()];
    const secret = process.env.SALLA_WEBHOOK_SECRET;

    const isValid = verifyWebhookSignature({
      rawBody: req.rawBody,
      signature,
      secret
    });

    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = normalizeEvent(req.body);

    if (!event.store_id || !event.type) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const existing = await findByExternalId(
      req,
      event.store_id,
      event.external_id,
      event.type
    );

    if (existing) {
      return res.json({ received: true, deduplicated: true });
    }

    // ✅ Save event and get ROWID
    const saved = await saveEvent(req, event);

    // ✅ Fire GA4 dispatch (non-blocking from webhook POV)
    dispatchGa4Event(req, event, saved.ROWID)
      .catch(err =>
        console.error("GA4 dispatch failed:", err.message)
      );

    console.log("✅ Event stored:", event.event_id);
    return res.json({ received: true });

  } catch (err) {
    console.error("Webhook failure:", err.message);
    return res.status(500).json({ error: "Webhook failed" });
  }
}
