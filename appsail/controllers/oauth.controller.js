import { exchangeCodeForToken } from "../services/salla.service.js";
import { encrypt } from "../security/encryption.js";
import { upsertStore } from "../datastore/stores.repo.js";

export async function oauthCallback(req, res) {
  try {
    /**
     * MVP NOTE (Easy Mode):
     * Tokens come from webhook event: app.store.authorize.
     * Keep this callback only for compatibility / future Custom Mode.
     */
    const code = req.query?.code;
    const store_id = String(req.query?.store_id || req.query?.merchant || "");

    const dashboardUrl = process.env.APP_BASE_URL || "/";

    // If no code, don’t fail startup or flow — just redirect.
    if (!code) {
      return res.redirect(`${dashboardUrl}?oauth=skipped`);
    }

    // Custom Mode fallback: exchange code for token
    const tokenResponse = await exchangeCodeForToken(code);

    // Only upsert if we have store_id + access_token
    if (store_id && tokenResponse?.access_token) {
      await upsertStore(req, {
        store_id,
        status: "active",
        access_token_enc: encrypt(tokenResponse.access_token),
        refresh_token_enc: tokenResponse.refresh_token
          ? encrypt(tokenResponse.refresh_token)
          : null,
        scope: tokenResponse.scope || null,
        token_expires_at: tokenResponse.expires_in
          ? new Date(Date.now() + Number(tokenResponse.expires_in) * 1000).toISOString()
          : null,
        installed_at: new Date().toISOString()
      });
    }

    return res.redirect(`${dashboardUrl}?oauth=success`);
  } catch (err) {
    console.error("OAuth error:", err?.response?.data || err?.message || err);
    const dashboardUrl = process.env.APP_BASE_URL || "/";
    return res.redirect(`${dashboardUrl}?oauth=failed`);
  }
}
