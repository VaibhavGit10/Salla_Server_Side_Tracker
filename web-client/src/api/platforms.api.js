import { apiGet } from "./http";

/**
 * Dashboard summary (aligned to backend)
 * -> GET /platforms/stats?store_id=...&hours=24
 */
export function fetchDashboardSummary(storeId, hours = 24) {
  return apiGet(`/platforms/stats?store_id=${storeId}&hours=${hours}`);
}

/**
 * Platform connection status
 * (No backend endpoint in current scope; remove or stub in UI)
 */
export function fetchPlatformStatus() {
  // If your UI uses this, keep as a stub to avoid breaking builds.
  return Promise.resolve({ ok: true, data: { ga4: "unknown" } });
}

/**
 * Validate GA4 connection (already aligned)
 * -> POST /platforms/ga4/validate
 */
export function validateGA4(payload) {
  return fetch("/platforms/ga4/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "GA4 validation failed");
    }
    return res.json();
  });
}
