// appsail/controllers/platform.controller.js

import { upsertGa4Settings } from "../datastore/ga4.repo.js";
import { getEventStats, listEventsCursor } from "../datastore/events.repo.js";
import { getStore, updateStoreName } from "../datastore/stores.repo.js";
import { getDispatchStatsForStore } from "../datastore/dispatch.repo.js";
import { decrypt } from "../security/encryption.js";
import { fetchStoreProfile } from "../services/salla.service.js";

/**
 * POST /platforms/ga4/connect
 * Body: { store_id, measurement_id, api_secret, enabled? }
 * Saves GA4 settings (api_secret stored in encrypted-text column by Datastore).
 */
export async function connectGA4(req, res) {
  try {
    const { store_id, measurement_id, api_secret } = req.body;
    const enabled = req.body?.enabled === undefined ? true : !!req.body.enabled;

    if (!store_id || !measurement_id || !api_secret) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing fields: store_id, measurement_id, api_secret" });
    }

    await upsertGa4Settings(req, {
      store_id: String(store_id).trim(),
      measurement_id: String(measurement_id).trim(),
      api_secret: String(api_secret).trim(),
      enabled
    });

    return res.json({ ok: true, status: "ga4_connected", store_id, enabled });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to connect GA4"
    });
  }
}

/**
 * GET /platforms/stats?store_id=...&hours=24
 * Web-client: counts by status for the last N hours (uses CREATEDTIME window).
 */
export async function getStats(req, res) {
  try {
    const store_id = String(req.query.store_id || "").trim();
    const hours = req.query.hours ? Number(req.query.hours) : 24;

    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const [stats, dispatchStats] = await Promise.all([
      getEventStats(req, { store_id, hours }),
      getDispatchStatsForStore(req, store_id, hours)
    ]);

    return res.json({
      ok: true,
      data: { ...(stats || {}), dispatch_by_platform: dispatchStats || {} }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to fetch stats"
    });
  }
}

/**
 * GET /platforms/events?store_id=...&limit=50&offset=0
 * Web-client: recent events table
 */
export async function getEvents(req, res) {
  try {
    const store_id = String(req.query.store_id || "").trim();
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const cursor = req.query.cursor; // optional

    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const { items, next_cursor } = await listEventsCursor(req, { store_id, limit, cursor });
    return res.json({ ok: true, data: items, next_cursor });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to fetch events" });
  }
}

/**
 * GET /platforms/stores
 * Returns ONLY the authenticated merchant's store (req.store_id), so no merchant
 * can see another's. Strips sensitive fields.
 */
export async function getStores(req, res) {
  try {
    const store = await getStore(req, req.store_id);
    if (!store) return res.json({ ok: true, data: [] });

    const { access_token_enc, refresh_token_enc, ROWID, ...safe } = store;
    return res.json({ ok: true, data: [safe] });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to load store"
    });
  }
}

/**
 * PATCH /platforms/stores/:store_id/name
 * Body: { name }
 * Manually set a display name for a store.
 */
export async function setStoreName(req, res) {
  try {
    const { store_id } = req.params;
    const name = String(req.body?.name || "").trim();

    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });
    if (!name) return res.status(400).json({ ok: false, error: "Missing name" });

    await updateStoreName(req, store_id, name);
    return res.json({ ok: true, store_id, name });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to update name" });
  }
}

/**
 * POST /platforms/stores/sync
 * Refresh the authenticated merchant's store name from the Salla API (source of
 * truth). Scoped to req.store_id only.
 */
export async function syncStoreNames(req, res) {
  try {
    const store = await getStore(req, req.store_id);
    if (!store) return res.json({ ok: true, data: [] });

    if (!store.access_token_enc || store.access_token_enc === "__pending_authorize__") {
      return res.json({
        ok: true,
        data: [{ store_id: req.store_id, status: "no_token", name: store.store_name || null }]
      });
    }

    try {
      const token = decrypt(store.access_token_enc);
      const profile = await fetchStoreProfile(token);

      if (profile?.name) {
        await updateStoreName(req, req.store_id, profile.name);
        return res.json({ ok: true, data: [{ store_id: req.store_id, status: "updated", name: profile.name }] });
      }
      return res.json({ ok: true, data: [{ store_id: req.store_id, status: "no_name_returned" }] });
    } catch (err) {
      return res.json({ ok: true, data: [{ store_id: req.store_id, status: "error", error: err?.message }] });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Sync failed" });
  }
}
