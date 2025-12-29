import * as repo from "../datastore/events.repo.js";
import { isDuplicateEvent } from "../pipeline/deduplicator.js";

export async function ingestEvent(event) {
  const duplicate = await isDuplicateEvent(event, repo);

  if (duplicate) {
    console.log("⚠️ Duplicate event ignored:", event.external_id);
    return { ignored: true };
  }

  await repo.saveEvent(event);

  console.log("📥 Event stored:", event.event_id);
  return { stored: true };
}
