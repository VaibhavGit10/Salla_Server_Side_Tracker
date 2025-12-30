import { getDatastore, getZCQL } from "./client.js";
import { encrypt } from "../security/encryption.js";

const TABLE = "stores";

/**
 * ZCQL string escape to avoid breaking queries when store_id contains quotes.
 * (ZCQL doesn't support parameterized queries in the SDK style we use here.)
 */
function escZcql(str) {
  return String(str || "").replace(/'/g, "''");
}

/**
 * Extract store_id consistently from Salla webhook payload.
 */
function extractStoreIdFromBody(body) {
  return String(body?.merchant || body?.store_id || "");
}

/**
 * Convert unix seconds -> ISO datetime
 */
function unixToIso(unixSeconds) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString();
}

export async function getStore(req, store_id) {
  if (!store_id) return null;

  const zcql = getZCQL(req);
  const query = `
    SELECT *
    FROM ${TABLE}
    WHERE store_id = '${escZcql(store_id)}'
    LIMIT 1
  `;

  const result = await zcql.executeZCQLQuery(query);
  if (!result || result.length === 0) return null;

  return result[0][TABLE];
}

/**
 * Generic upsert.
 * Use this if caller already prepared encrypted tokens + fields.
 */
export async function upsertStore(req, data) {
  if (!data?.store_id) throw new Error("store_id is required");

  const table = getDatastore(req).table(TABLE);
  const existing = await getStore(req, data.store_id);

  const payload = {
    store_id: String(data.store_id),

    // status lifecycle: authorized/installed/active/uninstalled
    status: data.status || "active",

    // IMPORTANT: keep these as passed-in (already encrypted by caller)
    access_token_enc: data.access_token_enc,
    refresh_token_enc: data.refresh_token_enc || null,

    scope: data.scope || null,
    token_expires_at: data.token_expires_at || null,

    updated_at: new Date().toISOString()
  };

  if (existing?.ROWID) {
    // Do NOT overwrite installed_at on updates
    await table.updateRow({ ROWID: existing.ROWID, ...payload });
    return { ...existing, ...payload };
  }

  // On insert, set installed_at
  return await table.insertRow({
    ...payload,
    installed_at: data.installed_at || new Date().toISOString()
  });
}

/**
 * Easy Mode: Handle app.store.authorize payload directly.
 * This is the production source of tokens for marketplace apps.
 *
 * Expected body shape (Salla):
 * - event: "app.store.authorize"
 * - merchant (store_id)
 * - data: { access_token, refresh_token, expires, scopes/scope }
 */
export async function upsertStoreAuth(req, body) {
  const store_id = extractStoreIdFromBody(body);
  const d = body?.data || {};

  if (!store_id) throw new Error("Missing store_id/merchant in authorize payload");
  if (!d.access_token) throw new Error("Missing data.access_token in authorize payload");

  // scopes may be array or string depending on Salla payload variant
  const scope =
    Array.isArray(d.scopes) ? d.scopes.join(" ") :
    (d.scope ? String(d.scope) : (d.scopes ? String(d.scopes) : null));

  const token_expires_at = d.expires ? unixToIso(d.expires) : null;

  // Encrypt here so caller stays clean
  return await upsertStore(req, {
    store_id,
    status: "authorized",
    access_token_enc: encrypt(d.access_token),
    refresh_token_enc: d.refresh_token ? encrypt(d.refresh_token) : null,
    scope,
    token_expires_at,
    installed_at: new Date().toISOString()
  });
}

/**
 * Mark store installed. Does NOT touch tokens.
 * (Tokens come from app.store.authorize.)
 */
export async function markStoreInstalled(req, bodyOrStoreId) {
  const store_id =
    typeof bodyOrStoreId === "string"
      ? bodyOrStoreId
      : extractStoreIdFromBody(bodyOrStoreId);

  if (!store_id) throw new Error("Missing store_id");

  const existing = await getStore(req, store_id);
  const table = getDatastore(req).table(TABLE);

  if (existing?.ROWID) {
    await table.updateRow({
      ROWID: existing.ROWID,
      status: "installed",
      updated_at: new Date().toISOString()
    });
    return true;
  }

  // If installed arrives before authorize (rare), create a minimal row.
  await table.insertRow({
    store_id,
    status: "installed",
    access_token_enc: "PENDING_AUTHORIZE",
    updated_at: new Date().toISOString(),
    installed_at: new Date().toISOString()
  });

  return true;
}

/**
 * Mark store uninstalled. Accepts store_id string OR webhook body.
 */
export async function markStoreUninstalled(req, bodyOrStoreId) {
  const store_id =
    typeof bodyOrStoreId === "string"
      ? bodyOrStoreId
      : extractStoreIdFromBody(bodyOrStoreId);

  if (!store_id) throw new Error("Missing store_id");

  const existing = await getStore(req, store_id);
  if (!existing?.ROWID) return null;

  const table = getDatastore(req).table(TABLE);
  await table.updateRow({
    ROWID: existing.ROWID,
    status: "uninstalled",
    updated_at: new Date().toISOString()
  });

  return true;
}
