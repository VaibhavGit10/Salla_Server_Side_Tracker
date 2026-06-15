import { Router } from "express";
import { embeddedLogin, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Exchange a Salla embedded token for our own session token.
router.post("/embedded", embeddedLogin);

// Current merchant/session info (scoped to the verified store).
router.get("/me", requireAuth, me);

export default router;
