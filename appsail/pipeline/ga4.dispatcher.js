import { getGa4Settings } from "../datastore/ga4.repo.js";
import { sendGa4Event } from "../platforms/ga4/ga4.service.js";
import { mapSallaOrderToGa4Purchase } from "../platforms/ga4/ga4.mapper.js";
import { updateEventStatus } from "../datastore/events.repo.js";

export async function dispatchGa4Event(req, event, rowid) {
  const ga4 = await getGa4Settings(req, event.store_id);

  if (!ga4) {
    console.log("GA4 not enabled for store:", event.store_id);
    return;
  }

  if (event.type !== "order.created") return;

  const payload = mapSallaOrderToGa4Purchase(event);

  await sendGa4Event({
    measurement_id: ga4.measurement_id,
    api_secret: ga4.api_secret,
    payload
  });

  await updateEventStatus(req, rowid, "sent");
}
