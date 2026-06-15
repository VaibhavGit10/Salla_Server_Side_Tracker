import express from "express";
import { saveAndValidateGa4, getGa4, saveGa4, retryGa4ByRowId } from "../controllers/ga4.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All GA4 settings are per-merchant.
router.use(requireAuth);

router.post("/validate", saveAndValidateGa4);
router.post("/save", saveGa4);
router.post("/retry/:rowid", retryGa4ByRowId);
router.get("/:store_id", getGa4);

export default router;
