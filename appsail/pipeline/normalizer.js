import crypto from "crypto";

function safeStableStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}

function sha1(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex");
}

/**
 * Salla store identifier is not always consistent across events.
 * We normalize store_id using best-known locations in priority order.
 */
function extractStoreId(body) {
  const id =
    body?.merchant ??
    body?.store_id ??
    body?.data?.store?.id ??
    body?.data?.store_id ??
    body?.data?.merchant ??
    "";

  return String(id).trim();
}

/**
 * Normalize ANY Salla webhook into our internal event model.
 *
 * BRD alignment:
 * - Multi-tenant: store_id always normalized (trim)
 * - Idempotency: external_id stable (business id preferred)
 * - Payload stays object in memory (stringify only at DB layer)
 */
export function normalizeEvent(body) {
  const eventType = String(body?.event || "").trim();
  const storeId = extractStoreId(body);

  // Prefer stable business identifiers (order id etc.)
  const dataId =
    body?.data?.id ??
    body?.data?.order_id ??
    body?.data?.order?.id ??
    body?.data?.shipment?.id ??
    null;

  /**
   * external_id must be stable per event instance.
   * Since DB dedupe key is (store_id, external_id, type),
   * external_id should NOT redundantly include store/type.
   */
  let external_id;

  if (dataId !== null && dataId !== undefined && String(dataId).trim() !== "") {
    external_id = String(dataId).trim();
  } else {
    // fallback stable subset (avoid volatile fields)
    const fallback = {
      event: eventType || null,
      store_id: storeId || null,
      created_at: body?.created_at ?? body?.data?.created_at ?? null
    };

    external_id = sha1(safeStableStringify(fallback));
  }

  return {
    event_id: crypto.randomUUID(),
    store_id: storeId,
    external_id,
    source: "salla",
    type: eventType,
    payload: body, // ✅ keep object (DB layer stringifies)
    status: "RECEIVED",
    retries: 0,
    last_attempt_at: null
  };
}
