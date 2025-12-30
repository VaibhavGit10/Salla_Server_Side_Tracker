import { upsertGa4Settings } from "../datastore/ga4.repo.js";
import { validateGa4Connection } from "../platforms/ga4/ga4.validator.js";

function normalizeEnabled(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}

/**
 * POST /platforms/ga4/validate
 * Body: { store_id, measurement_id, api_secret, enabled? }
 *
 * - Validates using GA4 debug endpoint (best for onboarding)
 * - Saves settings (encrypted at rest in repo)
 * - Allows merchants to keep GA4 disabled
 */
export async function saveAndValidateGa4(req, res) {
  try {
    const { store_id, measurement_id, api_secret } = req.body;
    const enabled = normalizeEnabled(req.body?.enabled ?? true);

    if (!store_id || !measurement_id || !api_secret) {
      return res.status(400).json({
        ok: false,
        error: "Missing fields: store_id, measurement_id, api_secret"
      });
    }

    // 1) Validate connection (should throw on invalid)
    const validation = await validateGa4Connection({
      store_id,
      measurement_id,
      api_secret
    });

    // 2) Save settings
    await upsertGa4Settings(req, {
      store_id,
      measurement_id,
      api_secret,
      enabled
    });

    return res.json({
      ok: true,
      status: "validated",
      enabled,
      validation // usually {validationMessages: []} or similar
    });
  } catch (err) {
    // Don’t leak secrets; return actionable message for UI
    const msg = err?.message || "GA4 validation failed";

    console.error("GA4 validation failed:", msg);

    return res.status(400).json({
      ok: false,
      error: msg
    });
  }
}
