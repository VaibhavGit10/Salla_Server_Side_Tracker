import { Router } from "express";

const router = Router();

router.get("/", (_, res) => {
  res.json({ status: "ok", service: "appsail-backend" });
});

export default router;
