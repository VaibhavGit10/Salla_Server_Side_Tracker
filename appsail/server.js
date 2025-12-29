import express from "express";
import cors from "cors";

import healthRoutes from "./routes/health.routes.js";
import oauthRoutes from "./routes/oauth.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import platformRoutes from "./routes/platform.routes.js";

import { rawBodySaver } from "./middlewares/rawBody.middleware.js";

import ga4Routes from "./routes/ga4.routes.js";

export function startServer() {
  const app = express();

  app.use(cors());
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


  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT;
  if (!PORT) {
    throw new Error("X_ZOHO_CATALYST_LISTEN_PORT not provided by AppSail");
  }

  app.listen(PORT, () => {
    console.log(`🚀 AppSail listening on port ${PORT}`);
  });
}
