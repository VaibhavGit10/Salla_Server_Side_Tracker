import axios from "axios";

export async function validateSnapToken({ api_token }) {
  if (!api_token) {
    return { valid: false, error: "Missing api_token" };
  }

  try {
    // Snap Business API — get current user info to verify token
    const res = await axios.get("https://adsapi.snapchat.com/v1/me", {
      headers: { Authorization: `Bearer ${api_token}` },
      timeout: 8000,
      validateStatus: () => true
    });

    if (res.status === 200 && res.data?.me) {
      return { valid: true };
    }

    const msg =
      res.data?.request_status ||
      res.data?.debug_message ||
      `Snap validation failed (HTTP ${res.status})`;
    return { valid: false, error: msg };
  } catch (err) {
    return { valid: false, error: err?.message || "Snap validation request failed" };
  }
}
