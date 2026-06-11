import { buildHashedUserData, buildDedupId } from "../../security/pii.js";

function pickValue(order) {
  const v =
    order?.amounts?.total?.amount ??
    order?.amounts?.total ??
    order?.total?.amount ??
    order?.total ??
    null;
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function pickCurrency(order) {
  return order?.currency || order?.amounts?.total?.currency || "SAR";
}

function buildItemIds(order) {
  const items = order?.items || order?.products || [];
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .map((item) => String(item.product_id || item.sku || item.id || ""))
    .filter(Boolean);
}

function mapEventType(event_type) {
  const map = {
    "order.created": "START_CHECKOUT",
    "order.paid": "PURCHASE",
    "order.status.updated": "PURCHASE"
  };
  return map[event_type] || "PURCHASE";
}

/**
 * Map an enriched InternalEvent to a Snapchat Conversions API payload.
 * NOTE: Snap requires ISO 8601 timestamps (not Unix epoch).
 */
export function mapToSnapPayload({ event, credentials }) {
  const order = event._order || {};
  const customer = event._customer || order.customer || {};
  const user_data = buildHashedUserData(customer);

  const snap_event_type = mapEventType(event.type);
  const dedup_id = buildDedupId(event.store_id, event.external_id, event.type);
  const value = pickValue(order);
  const currency = pickCurrency(order);
  const item_ids = buildItemIds(order);

  const payload = {
    pixel_id: credentials.pixel_id,
    type: snap_event_type,
    event_conversion_type: "WEB",
    timestamp: new Date().toISOString(), // Snap requires ISO 8601
    client_dedup_id: dedup_id,
    price: value,
    currency,
    transaction_id: String(order.id || event.external_id || "")
  };

  // Only include PII fields that have data
  if (user_data.em?.[0]) payload.hashed_email = user_data.em[0];
  if (user_data.ph?.[0]) payload.hashed_phone_number = user_data.ph[0];
  if (user_data.fn) payload.hashed_first_name_sha = user_data.fn;
  if (user_data.ln) payload.hashed_last_name_sha = user_data.ln;
  if (item_ids.length) payload.item_ids = item_ids;

  return payload;
}
