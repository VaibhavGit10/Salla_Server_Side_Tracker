export async function fetchEventLogs(storeId) {
  const res = await fetch(`/events?store_id=${storeId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch logs");
  }
  return res.json();
}
