import express from "express";
import { saveAndValidateGa4 } from "../controllers/ga4.controller.js";

const router = express.Router();

router.post("/validate", saveAndValidateGa4);

export default router;
