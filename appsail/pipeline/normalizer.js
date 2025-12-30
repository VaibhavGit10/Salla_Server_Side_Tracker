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
 * Normalize ANY Salla webhook into our internal event model.
 * - store_id extracted consistently
 * - external_id is stable (critical for idempotency)
 * - payload remains an OBJECT in memory (stringified only at DB layer)
 */
export function normalizeEvent(body) {
  const eventType = String(body?.event || "");
  const storeId = String(body?.store_id ?? body?.merchant ?? "");

  // Try to pick a stable business identifier first (order id etc.)
  const dataId =
    body?.data?.id ??
    body?.data?.order_id ??
    body?.data?.order?.id ??
    body?.data?.shipment?.id ??
    null;

  // Build a stable dedupe key
  // Prefer store+event+dataId; otherwise hash a reduced stable subset
  let external_id;

  if (dataId) {
    external_id = `${eventType}:${storeId}:${String(dataId)}`;
  } else {
    // fallback stable subset (avoid hashing entire body if it may include volatile fields)
    const fallback = {
      event: eventType,
      store_id: storeId,
      merchant: body?.merchant ?? null,
      created_at: body?.created_at ?? body?.data?.created_at ?? null
    };
    external_id = `${eventType}:${storeId}:${sha1(safeStableStringify(fallback))}`;
  }

  return {
    event_id: crypto.randomUUID(),
    store_id: storeId,
    external_id,
    source: "salla",
    type: eventType,
    payload: body,              // ✅ keep object (not string)
    status: "RECEIVED",
    retries: 0,
    last_attempt_at: null
  };
}
