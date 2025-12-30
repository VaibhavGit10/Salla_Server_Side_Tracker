import axios from "axios";

export async function sendGa4Event({ measurement_id, api_secret, payload }) {
  if (!measurement_id || !api_secret) {
    const err = new Error("Missing GA4 measurement_id or api_secret");
    err.http_status = 400;
    throw err;
  }

  const url =
    `https://www.google-analytics.com/mp/collect` +
    `?measurement_id=${encodeURIComponent(measurement_id)}` +
    `&api_secret=${encodeURIComponent(api_secret)}`;

  try {
    const resp = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
      // GA4 may return 2xx/4xx; we want the body either way
      validateStatus: () => true
    });

    if (resp.status >= 200 && resp.status < 300) {
      return { status: resp.status, data: resp.data };
    }

    const err = new Error(`GA4 request failed with status ${resp.status}`);
    err.http_status = resp.status;
    err.response_body = resp.data;
    throw err;
  } catch (e) {
    // Network / timeout / axios error shape
    const err = new Error(e?.message || "GA4 request failed");
    err.http_status = e?.http_status || e?.response?.status;
    err.response_body = e?.response_body || e?.response?.data;
    throw err;
  }
}
