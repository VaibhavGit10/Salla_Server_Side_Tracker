import {
  listConnections as listConnectionsRepo,
  upsertConnection,
  deleteConnection,
  getConnection
} from "../datastore/connections.repo.js";

import { validateMetaToken } from "../platforms/meta/meta.validator.js";
import { validateTikTokToken } from "../platforms/tiktok/tiktok.validator.js";
import { validateSnapToken } from "../platforms/snap/snap.validator.js";
import { validateGa4Connection } from "../platforms/ga4/ga4.validator.js";

import { mapToMetaPayload } from "../platforms/meta/meta.mapper.js";
import { sendMetaEvent } from "../platforms/meta/meta.service.js";
import { mapToTikTokPayload } from "../platforms/tiktok/tiktok.mapper.js";
import { sendTikTokEvent } from "../platforms/tiktok/tiktok.service.js";
import { mapToSnapPayload } from "../platforms/snap/snap.mapper.js";
import { sendSnapEvent } from "../platforms/snap/snap.service.js";

import { listDispatchLogsForEvent } from "../datastore/dispatch.repo.js";

const VALID_PLATFORMS = ["meta", "tiktok", "snap", "google"];

async function validateCredentials(platform, { pixel_id, api_token }) {
  switch (platform) {
    case "meta":
      return validateMetaToken({ pixel_id, api_token });
    case "tiktok":
      return validateTikTokToken({ api_token });
    case "snap":
      return validateSnapToken({ api_token });
    case "google": {
      try {
        await validateGa4Connection({
          store_id: "validation",
          measurement_id: pixel_id,  // pixel_id = measurement_id for GA4
          api_secret: api_token       // api_token = api_secret for GA4
        });
        return { valid: true };
      } catch (err) {
        return { valid: false, error: err?.message };
      }
    }
    default:
      return { valid: false, error: "Unknown platform" };
  }
}

/**
 * GET /api/connections?store_id=...
 */
export async function listConnections(req, res) {
  try {
    const store_id = String(req.query.store_id || "").trim();
    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const rows = await listConnectionsRepo(req, store_id);

    // Strip raw credentials — return only metadata
    const safe = rows.map(({ pixel_id, api_token, ...rest }) => ({
      ...rest,
      has_pixel_id: Boolean(pixel_id),
      has_api_token: Boolean(api_token)
    }));

    return res.json({ ok: true, data: safe });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
}

/**
 * POST /api/connections
 * Body: { store_id, platform, pixel_id, api_token, test_event_code?, dataset_id?, is_enabled? }
 */
export async function saveConnection(req, res) {
  try {
    const { store_id, platform, pixel_id, api_token, test_event_code, dataset_id, is_enabled } =
      req.body;

    if (!store_id || !platform) {
      return res.status(400).json({ ok: false, error: "Missing store_id or platform" });
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return res
        .status(400)
        .json({ ok: false, error: `Invalid platform. Must be: ${VALID_PLATFORMS.join(", ")}` });
    }
    if (!pixel_id || !api_token) {
      return res.status(400).json({ ok: false, error: "Missing pixel_id or api_token" });
    }

    // Validate credentials live
    const validation = await validateCredentials(platform, { pixel_id, api_token });

    await upsertConnection(req, {
      store_id: String(store_id).trim(),
      platform,
      pixel_id,         // Catalyst Encrypted Text column handles storage encryption
      api_token,        // Catalyst Encrypted Text column handles storage encryption
      test_event_code: test_event_code || null,
      dataset_id: dataset_id || null,
      is_enabled: is_enabled !== undefined ? is_enabled : true,
      validation_status: validation.valid ? "ok" : "error",
      last_validated_at: new Date().toISOString()
    });

    return res.json({
      ok: true,
      platform,
      validation_status: validation.valid ? "ok" : "error",
      validation_error: validation.valid ? null : validation.error
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
}

/**
 * DELETE /api/connections/:platform?store_id=...
 */
export async function removeConnection(req, res) {
  try {
    const { platform } = req.params;
    const store_id = String(req.query.store_id || "").trim();
    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const deleted = await deleteConnection(req, store_id, platform);
    return res.json({ ok: deleted, platform });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
}

/**
 * POST /api/connections/:platform/test?store_id=...
 * Fires a test event to the platform's test endpoint.
 */
export async function testConnection(req, res) {
  try {
    const { platform } = req.params;
    const store_id = String(req.query.store_id || req.body?.store_id || "").trim();
    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const conn = await getConnection(req, store_id, platform);
    if (!conn) return res.status(404).json({ ok: false, error: "Platform not connected" });

    const testEvent = {
      store_id,
      external_id: "test-order-001",
      type: "order.paid",
      event_id: `test-${Date.now()}`,
      _order: {
        id: "test-order-001",
        amounts: { total: { amount: 1.0, currency: "SAR" } }
      },
      _customer: {}
    };

    const credentials = {
      pixel_id: conn.pixel_id,
      api_token: conn.api_token,
      test_event_code: conn.test_event_code || null
    };

    try {
      let result;
      switch (platform) {
        case "meta": {
          const payload = mapToMetaPayload({ event: testEvent, credentials });
          result = await sendMetaEvent({ pixel_id: credentials.pixel_id, api_token: credentials.api_token, payload });
          break;
        }
        case "tiktok": {
          const payload = mapToTikTokPayload({ event: testEvent, credentials });
          result = await sendTikTokEvent({ api_token: credentials.api_token, payload });
          break;
        }
        case "snap": {
          const payload = mapToSnapPayload({ event: testEvent, credentials });
          result = await sendSnapEvent({ api_token: credentials.api_token, payload });
          break;
        }
        default:
          return res.status(400).json({ ok: false, error: "Test not supported for this platform" });
      }
      return res.json({ ok: true, platform, http_status: result.status });
    } catch (err) {
      return res.json({
        ok: false,
        platform,
        error: err?.message,
        http_status: err?.http_status
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
}

/**
 * GET /api/connections/:platform/health?store_id=...
 */
export async function getConnectionHealth(req, res) {
  try {
    const { platform } = req.params;
    const store_id = String(req.query.store_id || "").trim();
    if (!store_id) return res.status(400).json({ ok: false, error: "Missing store_id" });

    const conn = await getConnection(req, store_id, platform);
    if (!conn) return res.status(404).json({ ok: false, error: "Platform not connected" });

    return res.json({
      ok: true,
      platform,
      is_enabled: conn.is_enabled,
      validation_status: conn.validation_status,
      last_validated_at: conn.last_validated_at
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
}

/**
 * GET /api/connections/:platform/logs?store_id=...&event_rowid=...
 */
export async function getDispatchLogs(req, res) {
  try {
    const event_rowid = req.query.event_rowid;
    if (!event_rowid) return res.status(400).json({ ok: false, error: "Missing event_rowid" });

    const logs = await listDispatchLogsForEvent(req, event_rowid);
    return res.json({ ok: true, data: logs });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message });
  }
}
