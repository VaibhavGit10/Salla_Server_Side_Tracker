// appsail/controllers/platform.controller.js

import { upsertGa4Settings } from "../datastore/ga4.repo.js";
import { getEventStats, listEvents } from "../datastore/events.repo.js";
import { listStores } from "../datastore/stores.repo.js";

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

    const stats = await getEventStats(req, { store_id, hours });
    return res.json({ ok: true, data: stats });
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
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const rows = await listEvents(req, { store_id, limit, offset });
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to fetch events"
    });
  }
}

/**
 * GET /platforms/stores
 * Web-client: populate store dropdown (latest 50)
 */
export async function getStores(req, res) {
  try {
    const rows = await listStores(req, { limit: 50 });
    return res.json({ ok: true, data: rows });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to list stores"
    });
  }
}
