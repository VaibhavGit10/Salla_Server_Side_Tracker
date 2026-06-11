import { getDatastore, getZCQL } from "./client.js";

const TABLE = "event_dispatch_logs";

function escZcql(str) {
  return String(str || "").replace(/'/g, "''");
}

function parseRow(r) {
  return r?.[TABLE] || r?.event_dispatch_logs || r;
}

export async function createDispatchLog(req, data) {
  const table = getDatastore(req).table(TABLE);
  return await table.insertRow({
    event_rowid: data.event_rowid,
    store_id: String(data.store_id),
    platform: String(data.platform),
    status: data.status || "pending",
    http_status: data.http_status ? Number(data.http_status) : null,
    platform_response: data.platform_response
      ? String(data.platform_response).slice(0, 5000)
      : null,
    error_message: data.error_message
      ? String(data.error_message).slice(0, 2000)
      : null,
    attempt_count: Number(data.attempt_count) || 0,
    next_retry_at: data.next_retry_at || null,
    dispatched_at: data.dispatched_at || new Date().toISOString()
  });
}

export async function updateDispatchLog(req, rowid, patch) {
  if (!rowid) return;
  const table = getDatastore(req).table(TABLE);
  const update = { ROWID: rowid };

  if (patch.status !== undefined) update.status = patch.status;
  if (patch.http_status !== undefined) update.http_status = patch.http_status ? Number(patch.http_status) : null;
  if (patch.platform_response !== undefined) update.platform_response = patch.platform_response ? String(patch.platform_response).slice(0, 5000) : null;
  if (patch.error_message !== undefined) update.error_message = patch.error_message ? String(patch.error_message).slice(0, 2000) : null;
  if (patch.attempt_count !== undefined) update.attempt_count = Number(patch.attempt_count);
  if (patch.next_retry_at !== undefined) update.next_retry_at = patch.next_retry_at;
  if (patch.dispatched_at !== undefined) update.dispatched_at = patch.dispatched_at;

  await table.updateRow(update);
}

/**
 * Load all "retrying" dispatches.
 * We filter by next_retry_at in JavaScript since ZCQL can't compare text datetime columns.
 */
export async function getRetryableDispatches(req, limit = 50) {
  const zcql = getZCQL(req);
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE status = 'retrying'
    ORDER BY CREATEDTIME ASC
    LIMIT ${Math.min(Number(limit) || 50, 100)}
  `;
  const result = await zcql.executeZCQLQuery(q);
  return (result || []).map(parseRow).filter(Boolean);
}

export async function listDispatchLogsForEvent(req, event_rowid) {
  if (!event_rowid) return [];
  const zcql = getZCQL(req);
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE event_rowid = ${BigInt(event_rowid).toString()}
    ORDER BY CREATEDTIME ASC
    LIMIT 20
  `;
  const result = await zcql.executeZCQLQuery(q);
  return (result || []).map(parseRow).filter(Boolean);
}

function toCatalystDateTimeUTC(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

export async function getDispatchStatsForStore(req, store_id, hours = 24) {
  if (!store_id) return null;
  const zcql = getZCQL(req);

  const safeHours = Number.isFinite(Number(hours)) && Number(hours) > 0 ? Number(hours) : 24;
  const since = toCatalystDateTimeUTC(new Date(Date.now() - safeHours * 3600 * 1000));
  const timeClause = since ? `AND CREATEDTIME >= '${escZcql(since)}'` : "";

  const q = `
    SELECT platform, status, COUNT(ROWID) AS count
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
      ${timeClause}
    GROUP BY platform, status
    LIMIT 100
  `;
  const result = await zcql.executeZCQLQuery(q);
  const rows = (result || []).map(parseRow).filter(Boolean);

  const out = {};
  for (const r of rows) {
    const p = String(r.platform || "unknown");
    const s = String(r.status || "unknown");
    const c = Number(r.count || r.COUNT || 0);
    if (!out[p]) out[p] = {};
    out[p][s] = (out[p][s] || 0) + c;
  }
  return out;
}
