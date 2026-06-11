import axios from "axios";

const TIKTOK_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export async function sendTikTokEvent({ api_token, payload }) {
  if (!api_token) {
    throw new Error("TikTok Events API: missing api_token");
  }

  const res = await axios.post(TIKTOK_API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "Access-Token": api_token
    },
    timeout: 10000,
    validateStatus: () => true
  });

  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`TikTok API HTTP ${res.status}`);
    err.http_status = res.status;
    err.response_body = res.data;
    throw err;
  }

  // TikTok returns error codes in the body even on HTTP 200
  if (res.data?.code !== undefined && res.data.code !== 0) {
    const err = new Error(`TikTok error ${res.data.code}: ${res.data.message || "Unknown"}`);
    err.http_status = res.status;
    err.response_body = res.data;
    throw err;
  }

  return { ok: true, status: res.status, data: res.data };
}
