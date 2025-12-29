import { getDatastore, getZCQL } from "./client.js";

const TABLE = "ga4_settings";

/**
 * Insert or replace GA4 settings per store
 */
export async function upsertGa4Settings(req, data) {
  const datastore = getDatastore(req);
  const zcql = getZCQL(req);
  const table = datastore.table(TABLE);

  // Check existing row
  const query = `
    SELECT ROWID
    FROM ${TABLE}
    WHERE store_id = '${data.store_id}'
    LIMIT 1
  `;

  const result = await zcql.executeZCQLQuery(query);

  if (result && result.length > 0) {
    const rowid = result[0].ga4_settings.ROWID;
    await table.deleteRow(rowid);
  }

  await table.insertRow({
    store_id: data.store_id,
    measurement_id: data.measurement_id,
    api_secret: data.api_secret,
    enabled: data.enabled
  });
}

/**
 * Fetch enabled GA4 settings for store
 */
export async function getGa4Settings(req, store_id) {
  const zcql = getZCQL(req);

  const query = `
    SELECT *
    FROM ${TABLE}
    WHERE store_id = '${store_id}'
      AND enabled = true
    LIMIT 1
  `;

  const result = await zcql.executeZCQLQuery(query);

  return result && result.length > 0
    ? result[0].ga4_settings
    : null;
}
