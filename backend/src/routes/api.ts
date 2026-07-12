import { Router } from 'express';
import {
  alertController,
  dashboardController,
  deviceController,
  telemetryController,
} from '../controllers';

const router = Router();

router.post('/telemetry', (req, res, next) =>
  telemetryController.create(req, res, next)
);

router.get('/devices', (req, res, next) =>
  deviceController.list(req, res, next)
);

router.get('/devices/:id', (req, res, next) =>
  deviceController.getById(req, res, next)
);

router.get('/alerts', (req, res, next) =>
  alertController.list(req, res, next)
);

router.patch('/alerts/:id/acknowledge', (req, res, next) =>
  alertController.acknowledge(req, res, next)
);

router.get('/dashboard', (req, res, next) =>
  dashboardController.get(req, res, next)
);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
