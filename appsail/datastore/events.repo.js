// appsail/datastore/events.repo.js

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

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Max characters we let the `payload` column hold. The Catalyst column has a
// hard limit (10000 by default) — if a stringified payload exceeds it, the DB
// truncates it into INVALID JSON, which then renders as "{}" with no value in
// the UI. Default to just under the current column; raise EVENT_PAYLOAD_MAX_CHARS
// after enlarging the column to store payloads in full.
const PAYLOAD_MAX = Number(process.env.EVENT_PAYLOAD_MAX_CHARS || 9500);

// A compact but VALID-JSON view of an order payload that keeps everything our
// dispatchers (GA4/Meta/TikTok/Snap) and the UI use — id, amounts, currency,
// items, customer, store — and drops only bulky shipping/branch/bank detail.
function essentialPayload(b) {
  const d = (b && typeof b === "object" && b.data) || {};
  const items = Array.isArray(d.items)
    ? d.items.map((i) => ({
        id: i?.id,
        name: i?.name,
        sku: i?.sku,
        product_sku_id: i?.product_sku_id,
        quantity: i?.quantity,
        currency: i?.currency,
        amounts: i?.amounts,
        mpn: i?.mpn,
        gtin: i?.gtin
      }))
    : undefined;
  const c = d.customer || null;
  const s = d.store || null;
  return {
    event: b?.event ?? null,
    merchant: b?.merchant ?? null,
    created_at: b?.created_at ?? null,
    _truncated: true,
    data: {
      id: d.id ?? d.order_id ?? null,
      order_id: d.order_id ?? null,
      reference_id: d.reference_id ?? null,
      date: d.date ?? null,
      currency: d.currency ?? null,
      amounts: d.amounts ?? null,
      payment_method: d.payment_method ?? null,
      status: d.status ?? null,
      items,
      customer: c
        ? {
            id: c.id,
            full_name: c.full_name,
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email,
            mobile: c.mobile,
            mobile_code: c.mobile_code,
            country: c.country,
            city: c.city
          }
        : null,
      store: s ? { id: s.id, store_id: s.store_id, name: s.name, username: s.username } : null
    }
  };
}

// Always returns VALID JSON that fits within PAYLOAD_MAX. Stores the full
// payload when it fits; otherwise a trimmed-but-valid subset (never a truncated,
// unparseable string). Live dispatch uses the full in-memory payload, so nothing
// downstream loses data in real time — this only governs the stored copy.
function fitPayload(value) {
  const full = safeStringify(value);
  if (full.length <= PAYLOAD_MAX) return full;

  const obj = typeof value === "string" ? safeParse(value) : value;
  let out = safeStringify(essentialPayload(obj || {}));
  if (out.length <= PAYLOAD_MAX) return out;

  // Last resort for an enormous item list: drop items but keep order totals.
  const trimmed = essentialPayload(obj || {});
  if (trimmed.data) delete trimmed.data.items;
  out = safeStringify(trimmed);
  return out.length <= PAYLOAD_MAX
    ? out
    : safeStringify({ event: obj?.event ?? null, merchant: obj?.merchant ?? null, _truncated: true });
}

// ✅ Catalyst CREATEDTIME comparisons work best with: "YYYY-MM-DD HH:mm:ss" (UTC)
function toCatalystDateTimeUTC(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

// ✅ pick COUNT robustly (Catalyst aggregate sometimes returns different key names)
function pickCount(row) {
  if (!row || typeof row !== "object") return 0;

  if (row.count !== undefined) return Number(row.count) || 0;
  if (row.COUNT !== undefined) return Number(row.COUNT) || 0;

  // fallback: find any key containing "count"
  for (const k of Object.keys(row)) {
    const lk = k.toLowerCase();
    if (lk.includes("count")) {
      const n = Number(row[k]);
      if (Number.isFinite(n)) return n;
    }
  }

  return 0;
}

export async function saveEvent(req, event) {
  const table = getDatastore(req).table(TABLE);

  const row = await table.insertRow({
    event_id: event.event_id,
    store_id: String(event.store_id),
    external_id: event.external_id ? String(event.external_id) : null,
    source: event.source ? String(event.source) : "salla",
    type: String(event.type),
    payload: fitPayload(event.payload),
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
  // Use BigInt to avoid precision loss on 17-digit Catalyst ROWIDs (> MAX_SAFE_INTEGER)
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE ROWID = ${BigInt(rowid).toString()}
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
        WHERE ROWID = ${BigInt(rowid).toString()}
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
 * ✅ FIXED: Web-client stats counts by status (last N hours).
 * Uses CREATEDTIME window with Catalyst-friendly datetime format.
 */
export async function getEventStats(req, { store_id, hours = 24 } = {}) {
  if (!store_id) return null;

  const zcqlClient = getZCQL(req);

  const hrs = Number(hours);
  const safeHours = Number.isFinite(hrs) && hrs > 0 ? hrs : 24;

  const since = new Date(Date.now() - safeHours * 3600 * 1000);
  const sinceStr = toCatalystDateTimeUTC(since);

  // If conversion failed, fallback: stats without time window (still gives totals)
  const timeClause = sinceStr ? `AND CREATEDTIME >= '${escZcql(sinceStr)}'` : "";

  const q = `
    SELECT status, COUNT(ROWID) AS count
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
      ${timeClause}
    GROUP BY status
  `;

  const result = await zcqlClient.executeZCQLQuery(q);

  // Aggregate result shape can vary; normalize safely
  const rows = (result || [])
    .map((r) => r?.[TABLE] || r?.events || r)
    .filter(Boolean);

  const out = {
    store_id,
    since: sinceStr || null,
    hours: safeHours,
    total: 0,
    by_status: {}
  };

  for (const r of rows) {
    const status = String(r.status || "unknown").toLowerCase();
    const count = pickCount(r);

    out.by_status[status] = (out.by_status[status] || 0) + count;
    out.total += count;
  }

  return out;
}
