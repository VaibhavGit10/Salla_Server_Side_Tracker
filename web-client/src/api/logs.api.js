/**
 * Fetch event logs (aligned to backend)
 * -> GET /platforms/events?store_id=...&limit=50&offset=0
 */
export async function fetchEventLogs(storeId, limit = 50, offset = 0) {
  const res = await fetch(
    `/platforms/events?store_id=${storeId}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch logs");
  }
  return res.json();
}
