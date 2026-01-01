import { upsertGa4Settings, getGa4Settings } from "../datastore/ga4.repo.js";
import { validateGa4Connection } from "../platforms/ga4/ga4.validator.js";
import { getEventByRowId, updateEventStatus } from "../datastore/events.repo.js";
import { dispatchGa4Event } from "../pipeline/ga4.dispatcher.js";

function normalizeEnabled(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}

/**
 * GET /platforms/ga4/:store_id
 */
export async function getGa4(req, res) {
  try {
    const { store_id } = req.params;
    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const row = await getGa4Settings(req, store_id);
    return res.json({ ok: true, data: row || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to fetch GA4 settings" });
  }
}

/**
 * POST /platforms/ga4/save
 */
export async function saveGa4(req, res) {
  try {
    const { store_id, measurement_id, api_secret } = req.body;
    const enabled = normalizeEnabled(req.body?.enabled ?? true);

    if (!store_id) {
      return res.status(400).json({ ok: false, error: "Missing store_id" });
    }

    await upsertGa4Settings(req, {
      store_id,
      measurement_id: measurement_id ?? "",
      api_secret: api_secret ?? "",
      enabled
    });

    return res.json({ ok: true, status: "saved", enabled });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Failed to save GA4 settings" });
  }
}

/**
 * POST /platforms/ga4/validate
 */
export async function saveAndValidateGa4(req, res) {
  try {
    const { store_id, measurement_id, api_secret } = req.body;
    const enabled = normalizeEnabled(req.body?.enabled ?? true);

    if (!store_id || !measurement_id || !api_secret) {
      return res.status(400).json({
        ok: false,
        error: "Missing fields: store_id, measurement_id, api_secret"
      });
    }

    const validation = await validateGa4Connection({
      store_id,
      measurement_id,
      api_secret
    });

    await upsertGa4Settings(req, {
      store_id,
      measurement_id,
      api_secret,
      enabled
    });

    return res.json({
      ok: true,
      status: "validated",
      enabled,
      validation
    });
  } catch (err) {
    const msg = err?.message || "GA4 validation failed";
    console.error("GA4 validation failed:", msg);
    return res.status(400).json({ ok: false, error: msg });
  }
}

/**
 * POST /platforms/ga4/retry/:rowid
 * - increments retries
 * - sets last_error = MANUAL_RETRY
 * - then dispatches (dispatcher will mark sent/failed/skipped)
 */
export async function retryGa4ByRowId(req, res) {
  try {
    const { rowid } = req.params;
    if (!rowid) return res.status(400).json({ ok: false, error: "Missing rowid" });

    const row = await getEventByRowId(req, rowid);
    if (!row) return res.status(404).json({ ok: false, error: "Event not found" });

    // mark retry attempt (bump retries deterministically)
    await updateEventStatus(req, row.ROWID, "pending", {
      platform: "ga4",
      error: "MANUAL_RETRY",
      response: { rowid: row.ROWID },
      bump_retry: true
    });

    const event = {
      store_id: row.store_id,
      type: row.type,
      external_id: row.external_id,
      payload: row.payload
    };

    await dispatchGa4Event(req, event, row.ROWID);

    return res.json({ ok: true, status: "retry_attempted", rowid: row.ROWID });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Retry failed" });
  }
}
