import axios from "axios";

export async function validateTikTokToken({ api_token }) {
  if (!api_token) {
    return { valid: false, error: "Missing api_token" };
  }

  try {
    const res = await axios.get(
      "https://business-api.tiktok.com/open_api/v1.3/user/info/",
      {
        headers: { "Access-Token": api_token },
        timeout: 8000,
        validateStatus: () => true
      }
    );

    if (res.data?.code === 0) {
      return { valid: true };
    }

    const msg =
      res.data?.message ||
      `TikTok validation failed (HTTP ${res.status}, code ${res.data?.code})`;
    return { valid: false, error: msg };
  } catch (err) {
    return { valid: false, error: err?.message || "TikTok validation request failed" };
  }
}
