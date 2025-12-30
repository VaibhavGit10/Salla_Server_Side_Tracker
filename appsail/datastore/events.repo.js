import { getDatastore, getZCQL } from "./client.js";

const TABLE = "events";

/**
 * ZCQL escape helper to prevent query break if values contain single quotes.
 */
function escZcql(str) {
  return String(str || "").replace(/'/g, "''");
}

/**
 * Safe stringify for payload
 */
function safeStringify(value) {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return "{}";
  }
}

/**
 * Insert event into Datastore
 */
export async function saveEvent(req, event) {
  const table = getDatastore(req).table(TABLE);

  const row = await table.insertRow({
    event_id: event.event_id,
    store_id: String(event.store_id),
    external_id: event.external_id ? String(event.external_id) : null,
    source: event.source ? String(event.source) : "salla",
    type: String(event.type),
    payload: safeStringify(event.payload),
    status: event.status || "pending",
    retries: Number.isFinite(event.retries) ? event.retries : 0,
    last_attempt_at: event.last_attempt_at || null
  });

  return row; // includes ROWID
}

/**
 * Deduplication check using ZCQL
 * Unique key: (store_id, external_id, type)
 */
export async function findByExternalId(req, store_id, external_id, type) {
  if (!store_id || !external_id || !type) return null;

  const zcql = `
    SELECT ROWID
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
      AND external_id = '${escZcql(external_id)}'
      AND type = '${escZcql(type)}'
    LIMIT 1
  `;

  const zcqlClient = getZCQL(req);
  const result = await zcqlClient.executeZCQLQuery(zcql);

  if (!result || result.length === 0) return null;

  return result[0][TABLE] || result[0];
}

/**
 * Update event status + delivery metadata
 * metadata: {
 *   platform?: "ga4" | "meta" | "tiktok" | string
 *   http_status?: number
 *   error?: string
 *   response?: any (object/string)
 * }
 */
export async function updateEventStatus(req, rowid, status, metadata = {}) {
  if (!rowid) return;

  const table = getDatastore(req).table(TABLE);

  const patch = {
    ROWID: rowid,
    status,
    last_attempt_at: new Date().toISOString()
  };

  if (metadata.platform) patch.last_platform = String(metadata.platform);
  if (Number.isFinite(metadata.http_status)) patch.last_http_status = metadata.http_status;

  if (metadata.error) {
    patch.last_error = String(metadata.error).slice(0, 2000); // avoid huge strings
  }

  if (metadata.response !== undefined && metadata.response !== null) {
    let respStr;
    try {
      respStr = typeof metadata.response === "string"
        ? metadata.response
        : JSON.stringify(metadata.response);
    } catch {
      respStr = String(metadata.response);
    }
    patch.last_response = respStr.slice(0, 5000); // cap size
  }

  await table.updateRow(patch);
}
