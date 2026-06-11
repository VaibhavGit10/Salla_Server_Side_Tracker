import { listEnabledConnections } from "../datastore/connections.repo.js";
import { createDispatchLog, updateDispatchLog } from "../datastore/dispatch.repo.js";
import { getEventByRowId } from "../datastore/events.repo.js";

import { mapToMetaPayload } from "../platforms/meta/meta.mapper.js";
import { sendMetaEvent } from "../platforms/meta/meta.service.js";
import { mapToTikTokPayload } from "../platforms/tiktok/tiktok.mapper.js";
import { sendTikTokEvent } from "../platforms/tiktok/tiktok.service.js";
import { mapToSnapPayload } from "../platforms/snap/snap.mapper.js";
import { sendSnapEvent } from "../platforms/snap/snap.service.js";

// Retry delay per attempt index (ms): immediate → 30s → 5m → 30m → 2h
const RETRY_DELAYS_MS = [0, 30_000, 300_000, 1_800_000, 7_200_000];
const MAX_ATTEMPTS = 5;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const SUPPORTED_EVENTS = new Set(["order.created", "order.paid", "order.status.updated"]);

function getNextRetryAt(attemptCount) {
  const idx = Math.min(attemptCount, RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MS[idx]).toISOString();
}

function safeStr(v) {
  try {
    return (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 5000);
  } catch {
    return String(v).slice(0, 5000);
  }
}

function safeJsonParse(v) {
  try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; }
}

function extractOrderData(event) {
  const payload = safeJsonParse(event.payload) || event.payload || {};
  const order = payload?.data || {};
  return { order, customer: order.customer || {} };
}

async function sendToPlatform(event, connection) {
  const { platform, pixel_id, api_token, test_event_code, dataset_id } = connection;
  const { order, customer } = extractOrderData(event);
  const enrichedEvent = { ...event, _order: order, _customer: customer };
  const credentials = { pixel_id, api_token, test_event_code: test_event_code || null, dataset_id: dataset_id || null };

  switch (platform) {
    case "meta": {
      const payload = mapToMetaPayload({ event: enrichedEvent, credentials });
      return await sendMetaEvent({ pixel_id, api_token, payload });
    }
    case "tiktok": {
      const payload = mapToTikTokPayload({ event: enrichedEvent, credentials });
      return await sendTikTokEvent({ api_token, payload });
    }
    case "snap": {
      const payload = mapToSnapPayload({ event: enrichedEvent, credentials });
      return await sendSnapEvent({ api_token, payload });
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function dispatchAndLog(req, event, eventRowid, connection) {
  const { platform } = connection;

  let logRow;
  try {
    logRow = await createDispatchLog(req, {
      event_rowid: eventRowid,
      store_id: event.store_id,
      platform,
      status: "pending",
      attempt_count: 0,
      dispatched_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[dispatcher] Failed to create log for ${platform}:`, err?.message);
    return;
  }

  const logRowId = logRow?.ROWID;

  try {
    const result = await sendToPlatform(event, connection);
    if (logRowId) {
      await updateDispatchLog(req, logRowId, {
        status: "success",
        http_status: result.status,
        platform_response: safeStr(result.data),
        attempt_count: 1,
        dispatched_at: new Date().toISOString()
      });
    }
  } catch (err) {
    const httpStatus = err?.http_status;
    const shouldRetry = !httpStatus || RETRYABLE_STATUS.has(httpStatus);
    if (logRowId) {
      await updateDispatchLog(req, logRowId, {
        status: shouldRetry ? "retrying" : "failed",
        http_status: httpStatus || null,
        platform_response: safeStr(err?.response_body),
        error_message: String(err?.message || "Unknown error").slice(0, 2000),
        attempt_count: 1,
        next_retry_at: shouldRetry ? getNextRetryAt(1) : null,
        dispatched_at: new Date().toISOString()
      });
    }
    console.error(`[dispatcher] ${platform} failed (HTTP ${httpStatus || "?"}):`, err?.message);
  }
}

/**
 * Dispatch an event to all enabled meta/tiktok/snap connections for the store.
 * GA4 (via ga4_settings) is handled separately by ga4.dispatcher.js — no change there.
 */
export async function dispatchEvent(req, event, eventRowid) {
  if (!SUPPORTED_EVENTS.has(event.type)) return;

  let connections;
  try {
    connections = await listEnabledConnections(req, event.store_id);
  } catch (err) {
    console.error("[dispatcher] Failed to load connections:", err?.message);
    return;
  }

  const toDispatch = (connections || []).filter((c) =>
    ["meta", "tiktok", "snap"].includes(c.platform)
  );

  if (toDispatch.length === 0) return;

  for (const connection of toDispatch) {
    dispatchAndLog(req, event, eventRowid, connection).catch((err) =>
      console.error(`[dispatcher] Unhandled error for ${connection.platform}:`, err?.message)
    );
  }
}

/**
 * Re-run a failed dispatch log entry. Called by the retry job.
 */
export async function retryDispatchLog(req, logEntry, connection) {
  const attemptCount = Number(logEntry.attempt_count || 0);

  if (attemptCount >= MAX_ATTEMPTS) {
    await updateDispatchLog(req, logEntry.ROWID, {
      status: "dead",
      error_message: "Max retry attempts reached",
      next_retry_at: null
    });
    return;
  }

  let event;
  try {
    event = await getEventByRowId(req, logEntry.event_rowid);
  } catch {
    event = null;
  }

  if (!event) {
    await updateDispatchLog(req, logEntry.ROWID, {
      status: "dead",
      error_message: "Original event not found",
      next_retry_at: null
    });
    return;
  }

  const newAttemptCount = attemptCount + 1;

  try {
    const result = await sendToPlatform(event, connection);
    await updateDispatchLog(req, logEntry.ROWID, {
      status: "success",
      http_status: result.status,
      platform_response: safeStr(result.data),
      attempt_count: newAttemptCount,
      next_retry_at: null,
      dispatched_at: new Date().toISOString()
    });
  } catch (err) {
    const httpStatus = err?.http_status;
    const shouldRetry =
      newAttemptCount < MAX_ATTEMPTS && (!httpStatus || RETRYABLE_STATUS.has(httpStatus));

    await updateDispatchLog(req, logEntry.ROWID, {
      status: shouldRetry ? "retrying" : "failed",
      http_status: httpStatus || null,
      platform_response: safeStr(err?.response_body),
      error_message: String(err?.message || "Unknown error").slice(0, 2000),
      attempt_count: newAttemptCount,
      next_retry_at: shouldRetry ? getNextRetryAt(newAttemptCount) : null
    });
  }

}
