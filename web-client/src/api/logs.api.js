import { apiGet } from "./http";

/**
 * GET /platforms/events?store_id=...&limit=...&cursor=...
 */
export async function fetchEventLogs({ storeId, limit = 50, cursor } = {}) {
  const qs = new URLSearchParams();
  qs.set("store_id", storeId);
  qs.set("limit", String(limit));
  if (cursor !== undefined && cursor !== null && String(cursor) !== "") qs.set("cursor", String(cursor));
  return apiGet(`/platforms/events?${qs.toString()}`);
}
