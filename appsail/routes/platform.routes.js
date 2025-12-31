import { Router } from "express";
import { connectGA4, getStats, getEvents } from "../controllers/platform.controller.js";

const router = Router();

// Web-client read-only endpoints
router.get("/stats", getStats);
router.get("/events", getEvents);

// Simple GA4 connect endpoint (saves settings)
router.post("/ga4/connect", connectGA4);

export default router;
