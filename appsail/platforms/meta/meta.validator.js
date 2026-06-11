import axios from "axios";

/**
 * Validate a Meta System User access token via the Graph API debug_token endpoint.
 */
export async function validateMetaToken({ pixel_id, api_token }) {
  if (!pixel_id || !api_token) {
    return { valid: false, error: "Missing pixel_id or api_token" };
  }

  try {
    const url =
      `https://graph.facebook.com/debug_token` +
      `?input_token=${encodeURIComponent(api_token)}` +
      `&access_token=${encodeURIComponent(api_token)}`;

    const res = await axios.get(url, {
      timeout: 8000,
      validateStatus: () => true
    });

    if (res.status !== 200) {
      return { valid: false, error: `Meta API returned HTTP ${res.status}` };
    }

    const tokenData = res.data?.data;
    if (!tokenData?.is_valid) {
      const msg =
        res.data?.error?.message ||
        tokenData?.error?.message ||
        "Token is invalid or expired";
      return { valid: false, error: msg };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: err?.message || "Meta validation request failed" };
  }
}
