import { Router } from "express";
import { handleSallaWebhook } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/salla", handleSallaWebhook);

export default router;
