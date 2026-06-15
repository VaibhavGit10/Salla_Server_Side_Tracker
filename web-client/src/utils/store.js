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

/**
 * Reconcile the selected store id against the authorized stores list.
 *
 * `getStoreId()` blindly trusts whatever was last put in the URL / localStorage,
 * so a stale `?store_id=` value (e.g. an id that is no longer authorized) sticks
 * forever — causing empty dashboards and, worse, GA4/platform settings being
 * saved against the wrong store. This picks the real store instead:
 *   - keep the current selection if it IS one of the authorized stores,
 *   - else select the first `active` store (or the first store) and persist it.
 *
 * `stores` is the raw array from GET /platforms/stores (each item has store_id).
 * Returns the resolved store id (string), or "" when none are authorized yet.
 */
export function reconcileStoreId(stores) {
  const list = Array.isArray(stores) ? stores : [];
  const ids = list.map((s) => String(s?.store_id || "").trim()).filter(Boolean);

  const current = getStoreId();
  if (current && ids.includes(current)) return current;

  // nothing authorized yet (still loading / no stores) — don't clobber selection
  if (!ids.length) return current;

  const active = list.find(
    (s) => String(s?.status || "").toLowerCase() === "active"
  );
  const picked = String((active?.store_id ?? ids[0]) || "").trim();

  if (picked && picked !== current) setStoreId(picked); // persists + broadcasts
  return picked;
}
