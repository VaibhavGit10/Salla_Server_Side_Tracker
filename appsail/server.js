import express from "express";

import healthRoutes from "./routes/health.routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import authRoutes from "./routes/auth.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import platformRoutes from "./routes/platform.routes.js";
import ga4Routes from "./routes/ga4.routes.js";
import connectionsRoutes from "./routes/connections.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";

import { rawBodySaver } from "./middlewares/rawBody.middleware.js";

export function startServer() {
  const app = express();

  /**
   * ✅ CORS
   * The WebClient (static UI) and AppSail run on DIFFERENT Catalyst subdomains,
   * and the browser calls AppSail by absolute URL, so AppSail must send CORS
   * headers itself for trusted origins — not just localhost.
   *
   * IMPORTANT: Catalyst's gateway (server: ZGS) ALREADY injects
   * Access-Control-Allow-Origin (+ Access-Control-Allow-Credentials and a CSP)
   * for requests from its OWN project domains — the hosted WebClient on
   * *.catalystserverless.{in,com} and the *.catalystappsail.in subdomains. For
   * those origins we must NOT also set ACAO, or the browser sees TWO
   * Access-Control-Allow-Origin headers and rejects the response as a CORS
   * error. (That is exactly why the hosted WebClient broke while the custom
   * domain — which the gateway leaves untouched — kept working.) For every
   * other trusted origin (localhost, custom domains) the gateway adds nothing,
   * so AppSail is the sole source of CORS headers.
   *
   * Trusted origins:
   *   - http://localhost | 127.0.0.1 (any port)         → local dev
   *   - https://*.catalystserverless.in | .com          → Catalyst hosted UI (prod + development)
   *   - https://*.catalystappsail.in                    → AppSail subdomains (self / dev↔prod)
   *   - the custom production domain(s) below           → e.g. https://marketone.dsv-ksa.com
   *   - anything listed in CORS_ALLOWED_ORIGINS (CSV)    → extra custom domains
   *
   * We reflect the request Origin (never a bare "*") and emit each header
   * exactly once, so there are no duplicate-header rejections.
   */
  // Custom production domains MAPPED to this project in the Catalyst Console
  // (e.g. the Salla App URL). The gateway injects CORS (ACAO + credentials) for
  // these too — exactly like it does for its own *.catalystserverless.* domains —
  // but ONLY in the environment the domain is mapped to (marketone → production).
  // So the app must treat them as gateway-managed and NOT set ACAO itself, or the
  // browser gets two Access-Control-Allow-Origin headers and fails the request.
  const CATALYST_MAPPED_DOMAINS = [
    "https://marketone.dsv-ksa.com",
    "https://www.marketone.dsv-ksa.com"
  ];

  const extraOrigins = [
    ...CATALYST_MAPPED_DOMAINS,
    ...String(process.env.CORS_ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  ];

  // Origins the Catalyst gateway already emits Access-Control-Allow-Origin for:
  // its own *.catalystserverless.* / *.catalystappsail.in domains AND the custom
  // domains mapped to the project above. For ALL of these we let the gateway own
  // ACAO and must not duplicate it — see the note above.
  const isCatalystGatewayOrigin = (origin) =>
    /^https:\/\/([a-z0-9-]+\.)*catalystserverless\.(in|com)$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*catalystappsail\.in$/i.test(origin);

  const isGatewayManagedOrigin = (origin) =>
    isCatalystGatewayOrigin(origin) || CATALYST_MAPPED_DOMAINS.includes(origin);

  const isAllowedOrigin = (origin) => {
    if (!origin) return false;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
    if (isCatalystGatewayOrigin(origin)) return true;
    if (extraOrigins.includes(origin)) return true;
    return false;
  };

  app.use((req, res, next) => {
    const origin = req.headers.origin || "";

    if (isAllowedOrigin(origin)) {
      // Emit Access-Control-Allow-Origin ourselves ONLY when the gateway won't
      // (i.e. localhost / unmapped origins). For gateway-managed origins the
      // gateway already sets it; setting it again = two values = CORS failure.
      if (!isGatewayManagedOrigin(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      // The gateway does NOT set these, so we always provide them — required for
      // the preflight on the JSON POST endpoints (Content-Type: application/json).
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
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
  // Embedded-app session auth (POST /auth/embedded, GET /auth/me).
  app.use("/auth", authRoutes);
  // Salla's OAuth redirect URI is /auth/callback; keep /oauth for back-compat.
  app.use("/auth", oauthRoutes);
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
