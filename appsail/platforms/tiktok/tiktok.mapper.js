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

function buildContents(order) {
  const items = order?.items || order?.products || [];
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item) => ({
    content_id: String(item.product_id || item.sku || item.id || ""),
    content_type: "product",
    content_name: String(item.name || item.product?.name || ""),
    price: Number(item.price?.amount ?? item.price ?? 0),
    quantity: Number(item.quantity) || 1
  }));
}

function mapEventName(event_type) {
  const map = {
    "order.created": "InitiateCheckout",
    "order.paid": "PlaceAnOrder",
    "order.status.updated": "PlaceAnOrder"
  };
  return map[event_type] || "PlaceAnOrder";
}

/**
 * Map an enriched InternalEvent to a TikTok Events API payload.
 */
export function mapToTikTokPayload({ event, credentials }) {
  const order = event._order || {};
  const customer = event._customer || order.customer || {};
  const user_data = buildHashedUserData(customer);

  const event_name = mapEventName(event.type);
  const dedup_id = buildDedupId(event.store_id, event.external_id, event.type);
  const value = pickValue(order);
  const currency = pickCurrency(order);
  const contents = buildContents(order);

  const context = {
    user: {},
    page: {
      url: event._source_url || `https://salla.sa/store/${event.store_id}`
    }
  };

  if (user_data.em?.[0]) context.user.email = user_data.em[0];
  if (user_data.ph?.[0]) context.user.phone_number = user_data.ph[0];
  if (user_data.external_id) context.user.external_id = user_data.external_id;
  if (event._client_ip) context.ip = event._client_ip;
  if (event._client_ua) context.user_agent = event._client_ua;

  return {
    pixel_code: credentials.pixel_id,
    event: event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: dedup_id,
    properties: {
      currency,
      value,
      order_id: String(order.id || event.external_id || ""),
      ...(contents.length ? { contents } : {})
    },
    context
  };
}
