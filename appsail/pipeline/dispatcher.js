import { ingestEvent } from "../services/events.service.js";

export async function dispatchEvent(event) {
  return ingestEvent(event);
}
