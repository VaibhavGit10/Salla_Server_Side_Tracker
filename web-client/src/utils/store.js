export function getStoreId() {
  const params = new URLSearchParams(window.location.search);
  const storeId = params.get("store_id");

  if (!storeId) {
    console.warn("store_id missing in URL");
  }

  return storeId;
}
