import { getDatastore, getZCQL } from "./client.js";

const TABLE = "platform_connections";

function escZcql(str) {
  return String(str || "").replace(/'/g, "''");
}

function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "true" || s === "1";
  }
  return !!v;
}

function parseRow(r) {
  return r?.[TABLE] || r?.platform_connections || r;
}

export async function getConnection(req, store_id, platform) {
  if (!store_id || !platform) return null;
  const zcql = getZCQL(req);
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
      AND platform = '${escZcql(platform)}'
    LIMIT 1
  `;
  const result = await zcql.executeZCQLQuery(q);
  return parseRow(result?.[0]) || null;
}

export async function listConnections(req, store_id) {
  if (!store_id) return [];
  const zcql = getZCQL(req);
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
    ORDER BY CREATEDTIME ASC
    LIMIT 20
  `;
  const result = await zcql.executeZCQLQuery(q);
  return (result || []).map(parseRow).filter(Boolean);
}

export async function listEnabledConnections(req, store_id) {
  if (!store_id) return [];
  const zcql = getZCQL(req);
  const q = `
    SELECT *
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
      AND is_enabled = true
    ORDER BY CREATEDTIME ASC
    LIMIT 20
  `;
  const result = await zcql.executeZCQLQuery(q);
  return (result || []).map(parseRow).filter(Boolean);
}

export async function upsertConnection(req, data) {
  const table = getDatastore(req).table(TABLE);
  const existing = await getConnection(req, data.store_id, data.platform);

  const payload = {
    store_id: String(data.store_id),
    platform: String(data.platform),
    pixel_id: data.pixel_id ?? null,
    api_token: data.api_token ?? null,
    test_event_code: data.test_event_code ?? null,
    is_enabled: data.is_enabled !== undefined ? normalizeBool(data.is_enabled) : true,
    validation_status: data.validation_status || "pending",
    last_validated_at: data.last_validated_at || null,
    dataset_id: data.dataset_id ?? null
  };

  if (existing?.ROWID) {
    await table.updateRow({ ROWID: existing.ROWID, ...payload });
    return { ...existing, ...payload, ROWID: existing.ROWID };
  }

  return await table.insertRow(payload);
}

export async function updateValidationStatus(req, store_id, platform, status) {
  const existing = await getConnection(req, store_id, platform);
  if (!existing?.ROWID) return;
  const table = getDatastore(req).table(TABLE);
  await table.updateRow({
    ROWID: existing.ROWID,
    validation_status: status,
    last_validated_at: new Date().toISOString()
  });
}

export async function deleteConnection(req, store_id, platform) {
  const existing = await getConnection(req, store_id, platform);
  if (!existing?.ROWID) return false;
  const table = getDatastore(req).table(TABLE);
  await table.deleteRow(existing.ROWID);
  return true;
}
