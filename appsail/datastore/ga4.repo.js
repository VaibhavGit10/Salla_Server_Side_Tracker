import { getDatastore, getZCQL } from "./client.js";

const TABLE = "ga4_settings";

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

export async function upsertGa4Settings(req, data) {
  const table = getDatastore(req).table(TABLE);
  const zcql = getZCQL(req);

  const store_id = String(data.store_id);
  const measurement_id = String(data.measurement_id ?? "");
  const api_secret = String(data.api_secret ?? ""); // encrypted text column in DB
  const enabled = normalizeBool(data.enabled);

  const query = `
    SELECT ROWID
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
    LIMIT 1
  `;

  const result = await zcql.executeZCQLQuery(query);
  const existing = result?.[0]?.[TABLE] || result?.[0]?.ga4_settings;

  if (existing?.ROWID) {
    await table.updateRow({
      ROWID: existing.ROWID,
      store_id,
      measurement_id,
      api_secret,
      enabled
    });
    return existing.ROWID;
  }

  const row = await table.insertRow({
    store_id,
    measurement_id,
    api_secret,
    enabled
  });

  return row?.ROWID;
}

export async function getGa4Settings(req, store_id) {
  const zcql = getZCQL(req);

  const query = `
    SELECT *
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
    LIMIT 1
  `;

  const result = await zcql.executeZCQLQuery(query);
  const row = result?.[0]?.[TABLE] || result?.[0]?.ga4_settings;

  return row || null;
}
