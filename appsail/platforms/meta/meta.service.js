import axios from "axios";

const META_CAPI_BASE = "https://graph.facebook.com/v19.0";

export async function sendMetaEvent({ pixel_id, api_token, payload }) {
  if (!pixel_id || !api_token) {
    throw new Error("Meta CAPI: missing pixel_id or api_token");
  }

  const url =
    `${META_CAPI_BASE}/${encodeURIComponent(pixel_id)}/events` +
    `?access_token=${encodeURIComponent(api_token)}`;

  const res = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000,
    validateStatus: () => true
  });

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`Meta CAPI HTTP ${res.status}`);
    err.http_status = res.status;
    err.response_body = res.data;
    throw err;
  }

  return { ok: true, status: res.status, data: res.data };
}
