import { Router } from "express";

const router = Router();

router.get("/", (_, res) => {
  res.json({ status: "ok", service: "appsail-backend" });
});

// Returns which expected env vars are present (booleans only — never values).
// Useful for confirming an env-var change in Catalyst Console actually took effect
// after redeploy/restart. Safe to expose because it leaks no secret material.
router.get("/env", (_, res) => {
  const required = [
    "SALLA_CLIENT_ID",
    "SALLA_CLIENT_SECRET",
    "SALLA_WEBHOOK_SECRET",
    "APP_BASE_URL",
    "ENCRYPTION_KEY"
  ];
  const optional = ["DASHBOARD_URL", "NODE_ENV", "JOBS_SECRET", "SALLA_TOKEN_URL", "SALLA_REDIRECT_URI"];

  const presence = (name) => Boolean(process.env[name] && String(process.env[name]).length > 0);

  res.json({
    status: "ok",
    node_env: process.env.NODE_ENV || null,
    app_base_url: process.env.APP_BASE_URL || null,
    dashboard_url: process.env.DASHBOARD_URL || null,
    required: Object.fromEntries(required.map((k) => [k, presence(k)])),
    optional: Object.fromEntries(optional.map((k) => [k, presence(k)])),
    all_required_set: required.every(presence)
  });
});

export default router;
