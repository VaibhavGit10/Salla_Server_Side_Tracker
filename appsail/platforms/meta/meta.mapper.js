import { buildHashedUserData, buildDedupId } from "../../security/pii.js";

function pickValue(order) {
  const v =
    order?.amounts?.total?.amount ??
    order?.amounts?.total ??
    order?.total?.amount ??
    order?.total ??
    order?.total_amount ??
    null;
  const num = Number(v);
  return Number.isFinite(num) ? num : 0;
}

function pickCurrency(order) {
  return (
    order?.currency ||
    order?.amounts?.total?.currency ||
    order?.total?.currency ||
    "SAR"
  );
}

function buildContents(order) {
  const items = order?.items || order?.products || [];
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => ({
    id: String(item.product_id || item.sku || item.id || ""),
    quantity: Number(item.quantity) || 1,
    item_price: Number(item.price?.amount ?? item.price ?? 0)
  }));
}

function mapEventName(event_type) {
  const map = {
    "order.created": "InitiateCheckout",
    "order.paid": "Purchase",
    "order.status.updated": "Purchase",
    "order.cancelled": "CustomEvent"
  };
  return map[event_type] || "Purchase";
}

/**
 * Map an enriched InternalEvent to a Meta CAPI payload.
 * event._order  = the Salla order object (from payload.data)
 * event._customer = the Salla customer object (from payload.data.customer)
 */
export function mapToMetaPayload({ event, credentials }) {
  const order = event._order || {};
  const customer = event._customer || order.customer || {};

  const event_name = mapEventName(event.type);
  const dedup_id = buildDedupId(event.store_id, event.external_id, event.type);
  const value = pickValue(order);
  const currency = pickCurrency(order);
  const contents = buildContents(order);
  const user_data = buildHashedUserData(customer);

  const metaEvent = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: dedup_id,
    action_source: "website",
    user_data: {
      ...user_data,
      ...(event._client_ip ? { client_ip_address: event._client_ip } : {}),
      ...(event._client_ua ? { client_user_agent: event._client_ua } : {})
    },
    custom_data: {
      currency,
      value,
      order_id: String(order.id || event.external_id || ""),
      contents,
      num_items: contents.length || 1
    }
  };

  const payload = { data: [metaEvent] };

  if (credentials.test_event_code) {
    payload.test_event_code = credentials.test_event_code;
  }

  return payload;
}
