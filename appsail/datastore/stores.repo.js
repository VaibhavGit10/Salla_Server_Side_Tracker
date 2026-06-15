import { getDatastore, getZCQL } from "./client.js";
import { encrypt, decrypt } from "../security/encryption.js";
import { toCatalystDateTime, unixSecondsToCatalystDateTime } from "../utils/datetime.js";
import { fetchStoreProfile } from "../services/salla.service.js";

const TABLE = "stores";

/** ZCQL string escape */
function escZcql(str) {
  return String(str || "").replace(/'/g, "''");
}

/** Extract store_id consistently from Salla webhook payload */
function extractStoreIdFromBody(body) {
  const id =
    body?.merchant ??
    body?.store_id ??
    body?.data?.store?.id ??
    body?.data?.store_id ??
    body?.data?.merchant ??
    "";

  return String(id).trim();
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
 * Generic upsert. Caller provides already-encrypted tokens.
 * IMPORTANT: does not overwrite installed_at on update.
 */
export async function upsertStore(req, data) {
  if (!data?.store_id) throw new Error("store_id is required");

  const table = getDatastore(req).table(TABLE);
  const existing = await getStore(req, data.store_id);

  const payload = {
    store_id: String(data.store_id),
    status: data.status || "active",

    access_token_enc: data.access_token_enc,
    refresh_token_enc: data.refresh_token_enc || null,

    scope: data.scope || null,

    // ✅ MUST be Catalyst DateTime string if column type is datetime
    token_expires_at: data.token_expires_at || null,

    updated_at: toCatalystDateTime(new Date())
  };

  // Only include store_name if explicitly provided (avoid overwriting with null)
  if (data.store_name) payload.store_name = data.store_name;

  if (existing?.ROWID) {
    await table.updateRow({ ROWID: existing.ROWID, ...payload });
    return { ...existing, ...payload };
  }

  return await table.insertRow({
    ...payload,
    installed_at: data.installed_at || toCatalystDateTime(new Date())
  });
}

/**
 * Production install: Handle app.store.authorize payload.
 * Sets store to ACTIVE because tokens exist and webhook events should be accepted.
 */
export async function upsertStoreAuth(req, body) {
  const store_id = extractStoreIdFromBody(body);
  const d = body?.data || {};

  if (!store_id) throw new Error("Missing store_id/merchant in authorize payload");
  if (!d.access_token) throw new Error("Missing data.access_token in authorize payload");

  const scope =
    Array.isArray(d.scopes)
      ? d.scopes.join(" ")
      : (d.scope ? String(d.scope) : (d.scopes ? String(d.scopes) : null));

  // ✅ FIX: unix seconds -> "YYYY-MM-DD HH:mm:ss"
  const token_expires_at = d.expires ? unixSecondsToCatalystDateTime(d.expires) : null;

  // store_name is intentionally NOT taken from the webhook payload — it is the
  // localized storefront name. The real name is fetched from the Salla API via
  // refreshStoreNameFromApi() after the token is stored (see webhook controller).
  return await upsertStore(req, {
    store_id,
    status: "active",
    access_token_enc: encrypt(d.access_token),
    refresh_token_enc: d.refresh_token ? encrypt(d.refresh_token) : null,
    scope,
    token_expires_at,
    installed_at: toCatalystDateTime(new Date())
  });
}

/**
 * Optional lifecycle marker (tokens are NOT updated here).
 * If row doesn't exist, create minimal record.
 */
/**
 * Lifecycle marker (tokens are NOT updated here).
 * Salla demo stores will send order webhooks only after install, but authorize may come later.
 * To avoid 403, we mark store as ACTIVE on install/update events.
 */
export async function markStoreInstalled(req, bodyOrStoreId) {
  const isBody = typeof bodyOrStoreId !== "string";
  const store_id = isBody
    ? extractStoreIdFromBody(bodyOrStoreId)
    : bodyOrStoreId;

  if (!store_id) throw new Error("Missing store_id");

  const existing = await getStore(req, store_id);
  const table = getDatastore(req).table(TABLE);

  if (existing?.ROWID) {
    await table.updateRow({
      ROWID: existing.ROWID,
      status: "active",
      updated_at: toCatalystDateTime(new Date())
    });
    return true;
  }

  // If installed arrives before authorize, create minimal row.
  // access_token_enc is mandatory → keep placeholder.
  await table.insertRow({
    store_id,
    status: "active",
    access_token_enc: "__pending_authorize__",
    refresh_token_enc: null,
    scope: null,
    token_expires_at: null,
    updated_at: toCatalystDateTime(new Date()),
    installed_at: toCatalystDateTime(new Date())
  });

  return true;
}


/** Mark store uninstalled */
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
    updated_at: toCatalystDateTime(new Date())
  });

  return true;
}


export async function listStores(req, { limit = 50 } = {}) {
  const zcql = getZCQL(req);
  const q = `
    SELECT ROWID, store_id, store_name, status, updated_at, installed_at, access_token_enc
    FROM ${TABLE}
    ORDER BY MODIFIEDTIME DESC
    LIMIT ${Number(limit)}
  `;
  const result = await zcql.executeZCQLQuery(q);
  return (result || []).map(r => r[TABLE]).filter(Boolean);
}

export async function updateStoreName(req, store_id, name) {
  if (!store_id || !name) return;
  const existing = await getStore(req, store_id);
  if (!existing?.ROWID) return;
  const table = getDatastore(req).table(TABLE);
  await table.updateRow({
    ROWID: existing.ROWID,
    store_name: String(name).trim().slice(0, 200),
    updated_at: toCatalystDateTime(new Date())
  });
}

/**
 * Fetch the store's REAL name from the Salla API (using its stored OAuth token)
 * and persist it. This is the SINGLE source of truth for store_name — names are
 * never derived from webhook payloads. No-op when the store has no usable token.
 * Returns the resolved name, or null.
 */
export async function refreshStoreNameFromApi(req, store_id) {
  if (!store_id) return null;

  const row = await getStore(req, store_id);
  if (!row?.ROWID) return null;
  if (!row.access_token_enc || row.access_token_enc === "__pending_authorize__") return null;

  let token;
  try {
    token = decrypt(row.access_token_enc);
  } catch {
    return null;
  }

  const profile = await fetchStoreProfile(token);
  if (!profile?.name) return null;

  const table = getDatastore(req).table(TABLE);
  await table.updateRow({
    ROWID: row.ROWID,
    store_name: String(profile.name).trim().slice(0, 200),
    updated_at: toCatalystDateTime(new Date())
  });

  return profile.name;
}
