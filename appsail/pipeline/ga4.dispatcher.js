import { getGa4Settings } from "../datastore/ga4.repo.js";
import { sendGa4Event } from "../platforms/ga4/ga4.service.js";
import { mapSallaOrderToGa4Purchase } from "../platforms/ga4/ga4.mapper.js";
import { updateEventStatus } from "../datastore/events.repo.js";
import { getStore } from "../datastore/stores.repo.js";

function safeJsonParse(v) {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch {
    return null;
  }
}

async function skip(req, rowid, reason, extraResponse = null) {
  await updateEventStatus(req, rowid, "skipped", {
    platform: "ga4",
    error: reason,
    response: extraResponse
  });
}

export async function dispatchGa4Event(req, event, rowid) {
  // 0) Store guard (important for retry route too)
  try {
    const store = await getStore(req, event.store_id);
    if (store && String(store.status || "").toLowerCase() === "uninstalled") {
      await skip(req, rowid, "SKIPPED: STORE_UNINSTALLED");
      return;
    }
  } catch {
    // don't block dispatch if store fetch fails
  }

  // 1) MVP mapping rule: only order.created supported now
  if (event.type !== "order.created") {
    await skip(req, rowid, "SKIPPED: EVENT_DISABLED", { type: event.type });
    return;
  }

  // 2) Settings required
  const ga4 = await getGa4Settings(req, event.store_id);
  if (!ga4) {
    await skip(req, rowid, "SKIPPED: GA4_SETTINGS_NOT_FOUND");
    return;
  }

  // 3) Enabled check
  if (!ga4.enabled) {
    await skip(req, rowid, "SKIPPED: EVENT_DISABLED");
    return;
  }

  // 4) Config check
  if (!ga4.measurement_id || !ga4.api_secret) {
    await skip(req, rowid, "SKIPPED: GA4_NOT_CONFIGURED");
    return;
  }

  // 5) Extract order
  const payloadObj = safeJsonParse(event.payload) || event.payload;
  const order = payloadObj?.data;

  if (!order) {
    await updateEventStatus(req, rowid, "failed", {
      platform: "ga4",
      error: "Missing payload.data (order)"
    });
    return;
  }

  // 6) Dispatch
  try {
    const payload = mapSallaOrderToGa4Purchase({
      store_id: event.store_id,
      external_id: event.external_id,
      order
    });

    const resp = await sendGa4Event({
      measurement_id: ga4.measurement_id,
      api_secret: ga4.api_secret,
      payload
    });

    await updateEventStatus(req, rowid, "sent", {
      platform: "ga4",
      http_status: resp?.status,
      response: resp?.data
    });
  } catch (err) {
    await updateEventStatus(req, rowid, "failed", {
      platform: "ga4",
      http_status: err?.http_status,
      error: err?.message || "GA4 dispatch failed",
      response: err?.response_body,
      bump_retry: true
    });
  }
}
