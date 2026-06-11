import express from "express";

import healthRoutes from "./routes/health.routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import platformRoutes from "./routes/platform.routes.js";
import ga4Routes from "./routes/ga4.routes.js";
import connectionsRoutes from "./routes/connections.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";

import { rawBodySaver } from "./middlewares/rawBody.middleware.js";

export function startServer() {
  const app = express();

  /**
   * ✅ CORS SAFE MODE (IMPORTANT)
   * - In Catalyst hosted UI, Zoho gateway already adds CORS.
   * - If AppSail also adds CORS => duplicate header => browser blocks.
   *
   * So:
   * ✅ Add CORS headers ONLY for localhost dev
   * ❌ Add NOTHING for catalystserverless hosted UI
   */
  app.use((req, res, next) => {
    const origin = req.headers.origin || "";

    const isLocalhost =
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    // CORS rule:
    //  - Localhost dev: AppSail adds its own CORS (no gateway in the path).
    //  - Catalyst-hosted UI: gateway already adds CORS; if AppSail also adds
    //    them, the response gets DUPLICATE Access-Control-Allow-Origin headers
    //    and the browser rejects it → "Failed to fetch".
    if (isLocalhost) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
    }

    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ✅ JSON parser with raw body capture (keep)
  app.use(
    express.json({
      limit: "2mb",
      verify: rawBodySaver
    })
  );

  app.use("/health", healthRoutes);
  app.use("/oauth", oauthRoutes);
  app.use("/webhooks", webhookRoutes);
  app.use("/platforms", platformRoutes);
  app.use("/platforms/ga4", ga4Routes);
  app.use("/api/connections", connectionsRoutes);
  app.use("/jobs", jobsRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT;
  if (!PORT) throw new Error("X_ZOHO_CATALYST_LISTEN_PORT not provided by AppSail");

  app.listen(PORT, () => {
    console.log(`🚀 AppSail listening on port ${PORT}`);
  });
}
