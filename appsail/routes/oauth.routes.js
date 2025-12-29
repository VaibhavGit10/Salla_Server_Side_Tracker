import { Router } from "express";
import { oauthCallback } from "../controllers/oauth.controller.js";

const router = Router();

router.get("/callback", oauthCallback);

export default router;
