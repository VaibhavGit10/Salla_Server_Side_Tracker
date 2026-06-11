import { Router } from "express";
import { connectGA4, getStats, getEvents, getStores, syncStoreNames, setStoreName } from "../controllers/platform.controller.js";

const router = Router();

router.get("/stats", getStats);
router.get("/events", getEvents);
router.get("/stores", getStores);
router.post("/stores/sync", syncStoreNames);
router.patch("/stores/:store_id/name", setStoreName);

router.post("/ga4/connect", connectGA4);

export default router;
