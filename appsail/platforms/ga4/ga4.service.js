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

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`GA4 HTTP ${res.status}`);
    err.http_status = res.status;
    err.response_body = res.data;
    throw err;
  }

  return { ok: true, status: res.status, data: res.data };
}

export async function sendGa4Event({ measurement_id, api_secret, payload }) {
  const url = buildUrl({ measurement_id, api_secret, debug: false });
  try {
    return await postToGa4(url, payload);
  } catch (err) {
    const e = new Error(err?.message || "GA4 request failed");
    e.http_status = err?.http_status;
    e.response_body = err?.response_body;
    throw e;
  }
}

/**
 * ✅ Used by validateGa4Connection() to get validationMessages.
 */
export async function sendGa4DebugEvent({ measurement_id, api_secret, payload }) {
  const url = buildUrl({ measurement_id, api_secret, debug: true });
  try {
    return await postToGa4(url, payload);
  } catch (err) {
    const e = new Error(err?.message || "GA4 debug request failed");
    e.http_status = err?.http_status;
    e.response_body = err?.response_body;
    throw e;
  }
}
