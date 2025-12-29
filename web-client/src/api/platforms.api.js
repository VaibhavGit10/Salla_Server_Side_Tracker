import { apiGet } from "./http";

/**
 * Dashboard summary
 */
export function fetchDashboardSummary(storeId) {
  return apiGet(`/dashboard/summary?store_id=${storeId}`);
}

/**
 * Platform connection status
 */
export function fetchPlatformStatus() {
  return apiGet("/platforms/status");
}

/**
 * Validate GA4 connection
 */
export function validateGA4(payload) {
  return fetch("/platforms/ga4/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "GA4 validation failed");
    }
    return res.json();
  });
}