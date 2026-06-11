import { apiGet, apiPost, apiDelete } from "./http";

/**
 * GET /api/connections?store_id=...
 * Returns { ok, data: [{ platform, has_pixel_id, has_api_token, is_enabled, validation_status, ... }] }
 */
export function listConnections(storeId) {
  const qs = new URLSearchParams({ store_id: String(storeId || "") });
  return apiGet(`/api/connections?${qs.toString()}`);
}

/**
 * POST /api/connections
 * Body: { store_id, platform, pixel_id, api_token, test_event_code? }
 * Returns { ok, platform, validation_status, validation_error }
 */
export function saveConnection(body) {
  return apiPost("/api/connections", body);
}

/**
 * DELETE /api/connections/:platform?store_id=...
 */
export function removeConnection(storeId, platform) {
  const qs = new URLSearchParams({ store_id: String(storeId || "") });
  return apiDelete(`/api/connections/${encodeURIComponent(platform)}?${qs.toString()}`);
}

/**
 * POST /api/connections/:platform/test?store_id=...
 * Returns { ok, platform, http_status, error? }
 */
export function testConnection(storeId, platform) {
  const qs = new URLSearchParams({ store_id: String(storeId || "") });
  return apiPost(`/api/connections/${encodeURIComponent(platform)}/test?${qs.toString()}`, {});
}
