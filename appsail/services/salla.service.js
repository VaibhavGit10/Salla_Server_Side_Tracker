import axios from "axios";

const DEFAULT_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";
const INTROSPECT_URL = "https://api.salla.dev/exchange-authority/v1/introspect";

/**
 * Verify a Salla embedded-app session token via the Introspection API.
 * The embedded SDK (embedded.auth.getToken()) hands the iframe a short-lived
 * `em_tok_…`; we POST it here with our App ID in the S-Source header. Salla
 * returns the verified { merchant_id, user_id, exp } — merchant_id is the
 * trusted store id (the client cannot forge it).
 *
 * Returns { store_id, user_id, exp } or throws.
 */
export async function introspectEmbeddedToken(token) {
  if (!token) throw new Error("Missing embedded token");

  const appId = process.env.SALLA_APP_ID || "1297100528";

  const response = await axios.post(
    INTROSPECT_URL,
    { token },
    {
      headers: {
        "S-Source": String(appId),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: 10000
    }
  );

  const body = response.data || {};
  const d = body.data || {};

  if (body.success === false || !d.merchant_id) {
    throw new Error("Introspection returned no merchant_id");
  }

  return {
    store_id: String(d.merchant_id),
    user_id: d.user_id != null ? String(d.user_id) : null,
    exp: d.exp || null
  };
}

/**
 * Build redirect_uri exactly as registered in Salla Partner Portal.
 * Must match your OAuth callback URL.
 */
function getRedirectUri() {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    throw new Error("APP_BASE_URL is missing. Set it in AppSail env vars.");
  }
  // Must match the redirect URI registered in the Salla Partner Portal.
  return `${base.replace(/\/$/, "")}/auth/callback`;
}

function isMockAuthEnabled() {
  // ✅ Explicit opt-in only. Never rely on NODE_ENV.
  return String(process.env.SALLA_OAUTH_MOCK || "").toLowerCase() === "true";
}

/**
 * Exchange authorization code for access token (Custom Mode OAuth).
 * Salla token endpoint: https://accounts.salla.sa/oauth2/token :contentReference[oaicite:1]{index=1}
 * OAuth flow redirects to callback with ?code=... :contentReference[oaicite:2]{index=2}
 */
export async function exchangeCodeForToken(code) {
  if (!code) throw new Error("Missing OAuth code");

  // ✅ Mock mode for local/dev testing only (explicit flag)
  if (isMockAuthEnabled()) {
    return {
      access_token: `mock_access_token_${code}`,
      refresh_token: "mock_refresh_token",
      scope: "orders.read",
      expires_in: 1209600 // 14 days (example)
    };
  }

  const tokenUrl = process.env.SALLA_TOKEN_URL || DEFAULT_TOKEN_URL;
  const redirectUri = process.env.SALLA_REDIRECT_URI || getRedirectUri();

  const clientId = process.env.SALLA_CLIENT_ID;
  const clientSecret = process.env.SALLA_CLIENT_SECRET;

  if (!clientId) throw new Error("SALLA_CLIENT_ID missing");
  if (!clientSecret) throw new Error("SALLA_CLIENT_SECRET missing");

  try {
    // OAuth2 token endpoints (Salla uses Ory) require x-www-form-urlencoded,
    // NOT JSON. Sending JSON is rejected with invalid_request.
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    });

    const response = await axios.post(tokenUrl, form.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      timeout: 15000
    });

    const data = response.data || {};

    if (!data.access_token) {
      throw new Error("Token exchange succeeded but access_token missing");
    }

    return data;
  } catch (err) {
    // Never log secrets. Log safe error only.
    const status = err?.response?.status;
    const body = err?.response?.data;
    const detail =
      body?.error_description ||
      body?.error ||
      (typeof body === "string" ? body.slice(0, 200) : null) ||
      err?.message ||
      "unknown";

    console.error("Salla token exchange failed", {
      status,
      body: typeof body === "string" ? body.slice(0, 300) : body
    });

    const e = new Error(`token_exchange_failed${status ? `_${status}` : ""}: ${detail}`);
    e.reason = String(detail);
    e.status = status;
    throw e;
  }
}

/**
 * Refresh access token using refresh_token (future-proofing).
 * Token endpoint is the same. :contentReference[oaicite:4]{index=4}
 */
/**
 * Fetch store profile from Salla API using a valid access token.
 * Returns { name, domain, email } or null if the call fails.
 */
export async function fetchStoreProfile(accessToken) {
  if (!accessToken) return null;

  // Try the canonical store-profile endpoint first, then fall back. Both live
  // under the Salla Merchant API and return { data: { name, domain, ... } }.
  const endpoints = [
    "https://api.salla.dev/admin/v2/store/info",
    "https://api.salla.dev/admin/v2/settings/store"
  ];

  const pickName = (d) => {
    let n = d?.name ?? d?.store_name ?? d?.branch_name ?? null;
    // name can be a localized object: { ar: "...", en: "..." }
    if (n && typeof n === "object") n = n.en || n.ar || Object.values(n).find(Boolean) || null;
    return n ? String(n).trim() : null;
  };

  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        timeout: 10000
      });

      const d = response.data?.data || {};
      const name = pickName(d);
      if (name) {
        return {
          id: d.id ?? d.store_id ?? d.merchant ?? null,
          name,
          domain: d.domain || d.store_domain || null,
          email: d.email || null
        };
      }
    } catch (err) {
      const status = err?.response?.status;
      console.error("fetchStoreProfile failed", { url, status });
      // try the next endpoint
    }
  }

  return null;
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new Error("Missing refresh token");

  if (isMockAuthEnabled()) {
    return {
      access_token: `mock_access_token_refreshed_${Date.now()}`,
      refresh_token: "mock_refresh_token",
      scope: "orders.read",
      expires_in: 1209600
    };
  }

  const tokenUrl = process.env.SALLA_TOKEN_URL || DEFAULT_TOKEN_URL;

  const clientId = process.env.SALLA_CLIENT_ID;
  const clientSecret = process.env.SALLA_CLIENT_SECRET;

  if (!clientId) throw new Error("SALLA_CLIENT_ID missing");
  if (!clientSecret) throw new Error("SALLA_CLIENT_SECRET missing");

  try {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    });

    const response = await axios.post(tokenUrl, form.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      timeout: 15000
    });

    const data = response.data || {};
    if (!data.access_token) {
      throw new Error("Refresh succeeded but access_token missing");
    }

    return data;
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data;

    console.error("Salla refresh token failed", {
      status,
      body: typeof body === "string" ? body.slice(0, 300) : body
    });

    throw new Error(`Salla refresh failed${status ? ` (HTTP ${status})` : ""}`);
  }
}
