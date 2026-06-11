import axios from "axios";

function buildUrl({ measurement_id, api_secret, debug = false }) {
  const base = debug
    ? "https://www.google-analytics.com/debug/mp/collect"
    : "https://www.google-analytics.com/mp/collect";

  return (
    `${base}?measurement_id=${encodeURIComponent(measurement_id)}` +
    `&api_secret=${encodeURIComponent(api_secret)}`
  );
}

async function postToGa4(url, payload) {
  const res = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 7000,
    validateStatus: () => true // handle non-2xx manually
  });

  const ok = res.status >= 200 && res.status < 300;
  return { ok, status: res.status, data: res.data };
}

export async function sendGa4Event({ measurement_id, api_secret, payload }) {
  const url = buildUrl({ measurement_id, api_secret, debug: false });
  return postToGa4(url, payload);
}

/**
 * ✅ Used by validateGa4Connection() to get validationMessages.
 */
export async function sendGa4DebugEvent({ measurement_id, api_secret, payload }) {
  const url = buildUrl({ measurement_id, api_secret, debug: true });
  return postToGa4(url, payload);
}
