import { Router } from "express";
import { connectGA4, getStats, getEvents, getStores, syncStoreNames, setStoreName } from "../controllers/platform.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Every platform endpoint is per-merchant: require a session and scope to it.
router.use(requireAuth);

router.get("/stats", getStats);
router.get("/events", getEvents);
router.get("/stores", getStores);
router.post("/stores/sync", syncStoreNames);
router.patch("/stores/:store_id/name", setStoreName);

router.post("/ga4/connect", connectGA4);

export default router;
