import { exchangeCodeForToken } from "../services/salla.service.js";
import { encrypt } from "../security/encryption.js";
import { saveStore } from "../datastore/stores.repo.js";

export async function oauthCallback(req, res) {
  try {
    const { code, store_id } = req.query;

    if (!code || !store_id) {
      return res.status(400).json({ error: "Missing code or store_id" });
    }

    const tokenResponse = await exchangeCodeForToken(code);

    const store = {
      store_id,
      access_token: encrypt(tokenResponse.access_token),
      refresh_token: tokenResponse.refresh_token
        ? encrypt(tokenResponse.refresh_token)
        : null,
      scope: tokenResponse.scope || null,
      installed_at: new Date().toISOString(),
      status: "active"
    };

    await saveStore(store);

    return res.redirect(
      `${process.env.APP_BASE_URL}/app/index.html?installed=true`
    );

  } catch (err) {
    console.error("OAuth error:", err.response?.data || err.message);
    return res.status(500).json({ error: "OAuth installation failed" });
  }
}
