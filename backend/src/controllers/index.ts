import { Request, Response, NextFunction } from 'express';
import { telemetrySchema, telemetryService } from '../services/telemetryService';
import { dashboardService } from '../services/dashboardService';
import { webSocketGateway } from '../websocket/gateway';
import { AlertSeverity } from '../types/domain';

/**
 * Express controllers — thin HTTP adapters over service layer.
 */
export class TelemetryController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = telemetrySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten(),
        });
        return;
      }

      const reading = await telemetryService.ingest(parsed.data);
      res.status(201).json(reading);
    } catch (err) {
      next(err);
    }
  }
}

export class DeviceController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const devices = await dashboardService.getDevices();
      res.json(devices);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await dashboardService.getDeviceDetail(req.params.id);
      res.json(detail);
    } catch (err) {
      next(err);
    }
  }
}

export class AlertController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const severity = req.query.severity as AlertSeverity | undefined;
      const deviceId = req.query.deviceId as string | undefined;
      const acknowledged =
        req.query.acknowledged === undefined
          ? undefined
          : req.query.acknowledged === 'true';
      const resolved =
        req.query.resolved === undefined
          ? undefined
          : req.query.resolved === 'true';

      const alerts = await dashboardService.getAlerts({
        severity,
        deviceId,
        acknowledged,
        resolved,
      });
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  }

  async acknowledge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alert = await dashboardService.acknowledgeAlert(req.params.id);
      webSocketGateway.emitAlert({ action: 'acknowledged', alert });
      res.json(alert);
    } catch (err) {
      next(err);
    }
  }
}

export class DashboardController {
  async get(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await dashboardService.getSummary();
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
}

export const telemetryController = new TelemetryController();
export const deviceController = new DeviceController();
export const alertController = new AlertController();
export const dashboardController = new DashboardController();
