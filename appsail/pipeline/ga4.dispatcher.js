import { getGa4Settings } from "../datastore/ga4.repo.js";
import { sendGa4Event } from "../platforms/ga4/ga4.service.js";
import { mapSallaOrderToGa4Purchase } from "../platforms/ga4/ga4.mapper.js";
import { updateEventStatus } from "../datastore/events.repo.js";

export async function dispatchGa4Event(req, event, rowid) {
  if (event.type !== "order.created") {
    await updateEventStatus(req, rowid, "skipped", { platform: "ga4" });
    return;
  }

  const ga4 = await getGa4Settings(req, event.store_id);
  if (!ga4 || !ga4.enabled) {
    await updateEventStatus(req, rowid, "skipped", { platform: "ga4" });
    return;
  }

  const order = event.payload?.data; // your Salla webhook structure
  if (!order) {
    await updateEventStatus(req, rowid, "failed", {
      platform: "ga4",
      error: "Missing payload.data (order)"
    });
    return;
  }

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
      error: err?.message,
      response: err?.response_body
    });
  }
}
