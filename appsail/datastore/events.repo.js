import { getDatastore, getZCQL } from "./client.js";

const TABLE = "events";

function escZcql(str) {
  return String(str || "").replace(/'/g, "''");
}

function safeStringify(value) {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return "{}";
  }
}

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

  return row;
}

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

export async function getEventByRowId(req, rowid) {
  if (!rowid) return null;

  const zcqlClient = getZCQL(req);
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE ROWID = ${Number(rowid)}
    LIMIT 1
  `;

  const result = await zcqlClient.executeZCQLQuery(q);
  const row = result?.[0]?.[TABLE] || result?.[0]?.events;
  return row || null;
}

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
    patch.last_error = String(metadata.error).slice(0, 2000);
  }

  if (metadata.response !== undefined && metadata.response !== null) {
    let respStr;
    try {
      respStr =
        typeof metadata.response === "string"
          ? metadata.response
          : JSON.stringify(metadata.response);
    } catch {
      respStr = String(metadata.response);
    }
    patch.last_response = respStr.slice(0, 5000);
  }

  if (metadata.bump_retry === true) {
    try {
      const zcqlClient = getZCQL(req);
      const q = `
        SELECT ROWID, retries
        FROM ${TABLE}
        WHERE ROWID = ${Number(rowid)}
        LIMIT 1
      `;
      const result = await zcqlClient.executeZCQLQuery(q);
      const row = result?.[0]?.[TABLE] || result?.[0]?.events;
      patch.retries = Number(row?.retries || 0) + 1;
    } catch {
      // do nothing
    }
  }

  await table.updateRow(patch);
}

/**
 * Web-client: list recent events for a store (offset paging; keep for backwards compatibility).
 * Returns array of rows (newest first).
 */
export async function listEvents(req, { store_id, limit = 50, offset = 0 } = {}) {
  if (!store_id) return [];

  const zcqlClient = getZCQL(req);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);

  const q = `
    SELECT ROWID, event_id, store_id, external_id, source, type, status,
           payload,
           retries, last_attempt_at, last_platform, last_http_status, last_error, last_response, CREATEDTIME
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
    ORDER BY CREATEDTIME DESC
    LIMIT ${lim}
    OFFSET ${off}
  `;

  const result = await zcqlClient.executeZCQLQuery(q);
  return (result || []).map((r) => r[TABLE] || r.events || r).filter(Boolean);
}

/**
 * Cursor-based fetch for realtime UI.
 * cursor is ROWID (monotonic).
 * - cursor provided => fetch newer rows (ROWID > cursor) ascending
 * - no cursor => initial page (newest first)
 */
export async function listEventsCursor(req, { store_id, limit = 50, cursor } = {}) {
  if (!store_id) return { items: [], next_cursor: cursor || null };

  const zcqlClient = getZCQL(req);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);

  // incremental fetch
  if (cursor !== undefined && cursor !== null && String(cursor).trim() !== "") {
    const cur = Number(cursor);
    if (!Number.isFinite(cur) || cur < 0) return { items: [], next_cursor: cursor || null };

    const q = `
      SELECT ROWID, event_id, store_id, external_id, source, type, status,
             payload,
             retries, last_attempt_at, last_platform, last_http_status, last_error, last_response, CREATEDTIME
      FROM ${TABLE}
      WHERE store_id = '${escZcql(store_id)}'
        AND ROWID > ${cur}
      ORDER BY ROWID ASC
      LIMIT ${lim}
    `;

    const result = await zcqlClient.executeZCQLQuery(q);
    const items = (result || []).map((r) => r[TABLE] || r.events || r).filter(Boolean);

    const last = items.length ? Number(items[items.length - 1].ROWID) : cur;
    return { items, next_cursor: last };
  }

  // initial snapshot
  const q = `
    SELECT ROWID, event_id, store_id, external_id, source, type, status,
           payload,
           retries, last_attempt_at, last_platform, last_http_status, last_error, last_response, CREATEDTIME
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
    ORDER BY CREATEDTIME DESC
    LIMIT ${lim}
  `;

  const result = await zcqlClient.executeZCQLQuery(q);
  const items = (result || []).map((r) => r[TABLE] || r.events || r).filter(Boolean);

  const maxRow = items.length
    ? Math.max(...items.map((x) => Number(x.ROWID) || 0))
    : null;

  return { items, next_cursor: maxRow };
}

/**
 * Web-client: basic stats counts by status (optionally last N hours).
 */
export async function getEventStats(req, { store_id, hours = 24 } = {}) {
  if (!store_id) return null;

  const zcqlClient = getZCQL(req);
  const sinceIso = new Date(Date.now() - Number(hours) * 3600 * 1000).toISOString();

  const q = `
    SELECT status, COUNT(ROWID) AS count
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
      AND CREATEDTIME >= '${escZcql(sinceIso)}'
    GROUP BY status
  `;

  const result = await zcqlClient.executeZCQLQuery(q);
  const rows = (result || []).map((r) => r[TABLE] || r.events || r).filter(Boolean);

  const out = { store_id, since: sinceIso, total: 0, by_status: {} };
  for (const r of rows) {
    const status = String(r.status || "unknown");
    const count = Number(r.count || r.COUNT || 0);
    out.by_status[status] = count;
    out.total += count;
  }
  return out;
}
