import { getRetryableDispatches, updateDispatchLog } from "../datastore/dispatch.repo.js";
import { listEnabledConnections } from "../datastore/connections.repo.js";
import { retryDispatchLog } from "../pipeline/dispatcher.js";

/**
 * Retry job — runs every 60 seconds via Catalyst Cron.
 * Loads all "retrying" dispatch logs, checks if next_retry_at has passed,
 * and re-dispatches those that are due.
 */
export async function runRetryJob(req) {
  const results = { processed: 0, skipped: 0, errors: 0 };

  let retryable;
  try {
    retryable = await getRetryableDispatches(req, 50);
  } catch (err) {
    console.error("[retry-job] Failed to load retryable dispatches:", err?.message);
    return results;
  }

  if (!retryable || retryable.length === 0) {
    return results;
  }

  const now = new Date();

  for (const logEntry of retryable) {
    // Check if next_retry_at has passed
    if (logEntry.next_retry_at) {
      try {
        if (new Date(logEntry.next_retry_at) > now) {
          results.skipped++;
          continue;
        }
      } catch {
        // If date parse fails, process anyway
      }
    }

    try {
      // Find the active connection for this store + platform
      const connections = await listEnabledConnections(req, logEntry.store_id);
      const connection = connections.find((c) => c.platform === logEntry.platform);

      if (!connection) {
        // Platform was disconnected/disabled — mark dead
        await updateDispatchLog(req, logEntry.ROWID, {
          status: "dead",
          error_message: "Platform connection no longer active"
        });
        results.skipped++;
        continue;
      }

      await retryDispatchLog(req, logEntry, connection);
      results.processed++;
    } catch (err) {
      console.error(`[retry-job] Error on log ROWID ${logEntry.ROWID}:`, err?.message);
      results.errors++;
    }
  }

  console.log(
    `[retry-job] processed=${results.processed} skipped=${results.skipped} errors=${results.errors}`
  );
  return results;
}
