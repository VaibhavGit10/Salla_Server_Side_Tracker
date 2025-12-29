import { upsertGa4Settings } from "../datastore/ga4.repo.js";
import { validateGa4Connection } from "../platforms/ga4/ga4.validator.js";

export async function saveAndValidateGa4(req, res) {
  try {
    const { store_id, measurement_id, api_secret } = req.body;

    if (!store_id || !measurement_id || !api_secret) {
      return res.status(400).json({ error: "Missing fields" });
    }

    await validateGa4Connection({
      store_id,
      measurement_id,
      api_secret
    });

    await upsertGa4Settings(req, {
      store_id,
      measurement_id,
      api_secret,
      enabled: true
    });

    return res.json({ status: "validated" });
  } catch (err) {
    console.error("GA4 validation failed:", err.message);
    return res.status(400).json({ error: "GA4 validation failed" });
  }
}
