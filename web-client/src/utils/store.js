const KEY = "selected_store_id";

export function getStoreId() {
  const params = new URLSearchParams(window.location.search);
  const urlStore = params.get("store_id");

  if (urlStore) {
    const clean = String(urlStore).trim();
    localStorage.setItem(KEY, clean);
    return clean;
  }

  return String(localStorage.getItem(KEY) || "").trim();
}

export function setStoreId(storeId) {
  const id = String(storeId || "").trim();
  if (!id) return;

  localStorage.setItem(KEY, id);

  // ✅ same-tab notify (Dashboard listens to this)
  window.dispatchEvent(
    new CustomEvent("store_id_changed", { detail: { storeId: id } })
  );
}
