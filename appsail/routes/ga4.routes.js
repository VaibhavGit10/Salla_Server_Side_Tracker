import express from "express";
import { saveAndValidateGa4, getGa4, saveGa4, retryGa4ByRowId } from "../controllers/ga4.controller.js";

const router = express.Router();

router.post("/validate", saveAndValidateGa4);
router.post("/save", saveGa4);
router.post("/retry/:rowid", retryGa4ByRowId);
router.get("/:store_id", getGa4);

export default router;
