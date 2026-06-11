import axios from "axios";

const SNAP_CAPI_URL = "https://tr.snapchat.com/v2/conversion";

export async function sendSnapEvent({ api_token, payload }) {
  if (!api_token) {
    throw new Error("Snap CAPI: missing api_token");
  }

  const res = await axios.post(SNAP_CAPI_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_token}`
    },
    timeout: 10000,
    validateStatus: () => true
  });

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`Snap CAPI HTTP ${res.status}`);
    err.http_status = res.status;
    err.response_body = res.data;
    throw err;
  }

  return { ok: true, status: res.status, data: res.data };
}
