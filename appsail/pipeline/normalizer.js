import { v4 as uuid } from "uuid";

export function normalizeEvent(body) {
  return {
    event_id: uuid(),
    external_id: body.data?.order_id || null,
    store_id: body.store_id,
    source: "salla",
    type: body.event,
    payload: body.data || {},
    status: "pending",
    retries: 0,
    created_at: new Date().toISOString(),
    last_attempt_at: null
  };
}
