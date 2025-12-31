import * as repo from "../datastore/events.repo.js";
import { isDuplicateEvent } from "../pipeline/deduplicator.js";

/**
 * Ingest event using repo + dedupe.
 * NOTE: repo functions require Catalyst req context.
 */
export async function ingestEvent(req, event) {
  const duplicate = await isDuplicateEvent(event, {
    findByExternalId: (store_id, external_id, type) =>
      repo.findByExternalId(req, store_id, external_id, type)
  });

  if (duplicate) {
    console.log("⚠️ Duplicate event ignored:", event.external_id);
    return { ignored: true };
  }

  await repo.saveEvent(req, event);

  console.log("📥 Event stored:", event.event_id);
  return { stored: true };
}
