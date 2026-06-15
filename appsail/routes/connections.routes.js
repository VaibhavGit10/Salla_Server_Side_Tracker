import { Router } from "express";
import {
  listConnections,
  saveConnection,
  removeConnection,
  testConnection,
  getConnectionHealth,
  getDispatchLogs
} from "../controllers/connections.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// All platform-connection endpoints are per-merchant.
router.use(requireAuth);

router.get("/", listConnections);
router.post("/", saveConnection);
router.delete("/:platform", removeConnection);
router.post("/:platform/test", testConnection);
router.get("/:platform/health", getConnectionHealth);
router.get("/logs", getDispatchLogs);

export default router;
