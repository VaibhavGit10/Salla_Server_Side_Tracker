import { getDatastore, getZCQL } from "./client.js";

const TABLE = "events";

/**
 * Insert event into Datastore
 */
export async function saveEvent(req, event) {
  const table = getDatastore(req).table("events");

  const row = await table.insertRow({
    event_id: event.event_id,
    store_id: event.store_id,
    external_id: event.external_id,
    source: event.source,
    type: event.type,
    payload: JSON.stringify(event.payload),
    status: event.status,
    retries: event.retries,
    last_attempt_at: event.last_attempt_at
  });

  return row; // 🔑 must include ROWID
}


/**
 * Deduplication check using ZCQL
 */
export async function findByExternalId(req, store_id, external_id, type) {
  if (!store_id || !external_id || !type) return null;

  const zcql = `
    SELECT ROWID
    FROM ${TABLE}
    WHERE store_id = '${store_id}'
      AND external_id = '${external_id}'
      AND type = '${type}'
    LIMIT 1
  `;

  const zcqlClient = getZCQL(req);
  const result = await zcqlClient.executeZCQLQuery(zcql);

  if (!result || result.length === 0) return null;

  // Catalyst ZCQL result shape
  return result[0].events || result[0];
}

/**
 * Update event status
 */
export async function updateEventStatus(req, rowid, status) {
  if (!rowid) return;

  const table = getDatastore(req).table(TABLE);

  await table.updateRow({
    ROWID: rowid,
    status,
    last_attempt_at: new Date().toISOString()
  });
}
