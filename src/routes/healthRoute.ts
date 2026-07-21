// routes/healthRoute.ts — liveness probe. No auth, no DB dependency, so it stays
// green even if Mongo blips. Used by UptimeRobot against the production URL.
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
