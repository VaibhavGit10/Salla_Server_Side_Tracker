// web-client/src/api/platforms.api.js

import { apiGet, apiPost } from "./http";

/**
 * Dashboard summary
 * -> GET /platforms/stats?store_id=...&hours=24
 */
export function fetchDashboardSummary(storeId, hours = 24) {
  return apiGet(
    `/platforms/stats?store_id=${encodeURIComponent(storeId)}&hours=${encodeURIComponent(hours)}`
  );
}

/**
 * Stores list for dropdown
 * -> GET /platforms/stores
 */
export function fetchStores() {
  return apiGet("/platforms/stores");
}

/**
 * Validate GA4 credentials
 * -> POST /platforms/ga4/validate
 */
export function validateGA4(payload) {
  return apiPost("/platforms/ga4/validate", payload);
}

/**
 * Save GA4 settings
 * -> POST /platforms/ga4/connect
 */
export function saveGA4(payload) {
  return apiPost("/platforms/ga4/connect", payload);
}

/**
 * OPTIONAL: only use if backend exists:
 * -> GET /platforms/ga4/:store_id
 */
export function fetchGA4(storeId) {
  return apiGet(`/platforms/ga4/${encodeURIComponent(storeId)}`);
}

/**
 * OPTIONAL retry: only use if backend exists:
 * -> POST /platforms/ga4/retry/:rowid
 */
export function retryGA4(rowid) {
  return apiPost(`/platforms/ga4/retry/${encodeURIComponent(rowid)}`, {});
}
