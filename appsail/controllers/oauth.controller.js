import { exchangeCodeForToken, fetchStoreProfile } from "../services/salla.service.js";
import { encrypt } from "../security/encryption.js";
import { upsertStore } from "../datastore/stores.repo.js";
import { toCatalystDateTime } from "../utils/datetime.js";

/**
 * Salla OAuth (Custom Mode) callback — GET /auth/callback (also /oauth/callback).
 *
 * The authorization-code redirect carries `code` + `state` + `scope` but NO
 * store_id, so after exchanging the code we resolve the store id AND the real
 * store name from the Salla API, then persist the tokens + name.
 */
export async function oauthCallback(req, res) {
  // DASHBOARD_URL = the React UI to land on after OAuth. APP_BASE_URL is this
  // AppSail itself; only used as a last-resort fallback.
  const dashboardUrl = process.env.DASHBOARD_URL || process.env.APP_BASE_URL || "/";

  try {
    const code = req.query?.code;
    if (!code) {
      return res.redirect(`${dashboardUrl}?oauth=skipped`);
    }

    // 1) Exchange the authorization code for tokens
    const tokenResponse = await exchangeCodeForToken(code);
    if (!tokenResponse?.access_token) {
      return res.redirect(`${dashboardUrl}?oauth=failed`);
    }

    // 2) Resolve store id + real name from the Salla API (the callback has no
    //    store_id of its own). store/info returns { id, name, ... }.
    const profile = await fetchStoreProfile(tokenResponse.access_token);
    const store_id = String(
      req.query?.store_id || req.query?.merchant || profile?.id || ""
    ).trim();

    if (!store_id) {
      console.error("OAuth callback: could not resolve store_id from Salla");
      return res.redirect(`${dashboardUrl}?oauth=failed&reason=no_store_id`);
    }

    // 3) Persist tokens + the real store name (store_name omitted if unknown so
    //    we never overwrite an existing name with null).
    const token_expires_at = tokenResponse.expires_in
      ? toCatalystDateTime(new Date(Date.now() + Number(tokenResponse.expires_in) * 1000))
      : null;

    await upsertStore(req, {
      store_id,
      status: "active",
      access_token_enc: encrypt(tokenResponse.access_token),
      refresh_token_enc: tokenResponse.refresh_token
        ? encrypt(tokenResponse.refresh_token)
        : null,
      scope: tokenResponse.scope || null,
      token_expires_at,
      store_name: profile?.name || undefined
    });

    return res.redirect(
      `${dashboardUrl}?oauth=success&store_id=${encodeURIComponent(store_id)}`
    );
  } catch (err) {
    console.error("OAuth error:", err?.response?.data || err?.message || err);
    const reason = encodeURIComponent(
      String(err?.reason || err?.message || "unknown").slice(0, 200)
    );
    return res.redirect(`${dashboardUrl}?oauth=failed&reason=${reason}`);
  }
}
