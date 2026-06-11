import { Router } from "express";
import {
  listConnections,
  saveConnection,
  removeConnection,
  testConnection,
  getConnectionHealth,
  getDispatchLogs
} from "../controllers/connections.controller.js";

const router = Router();

router.get("/", listConnections);
router.post("/", saveConnection);
router.delete("/:platform", removeConnection);
router.post("/:platform/test", testConnection);
router.get("/:platform/health", getConnectionHealth);
router.get("/logs", getDispatchLogs);

export default router;
