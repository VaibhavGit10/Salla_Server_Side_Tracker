import { Router } from "express";
import { runRetryJob } from "../jobs/retry.job.js";

const router = Router();

/**
 * POST /jobs/retry
 * Called by Catalyst Cron every 60 seconds.
 * Optionally secured by X-Jobs-Secret header.
 */
router.post("/retry", async (req, res) => {
  const expectedSecret = process.env.JOBS_SECRET;
  if (expectedSecret) {
    const provided = req.headers["x-jobs-secret"] || req.query.secret;
    if (provided !== expectedSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const results = await runRetryJob(req);
    return res.json({ ok: true, ...results });
  } catch (err) {
    console.error("[jobs/retry]", err?.message);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});

export default router;
