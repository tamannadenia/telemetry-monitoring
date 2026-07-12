import prisma from '../database/prisma';
import { telemetryService } from './telemetryService';
import { AlertSeverity, DeviceStatus } from '../types/domain';

const SEVERITY_ORDER: AlertSeverity[] = [
  'critical',
  'offline',
  'warning',
  'info',
];

/**
 * Dashboard aggregation: fleet health cards, device rows, and latest alerts.
 */
export class DashboardService {
  async getSummary() {
    const devices = await prisma.device.findMany({
      orderBy: { name: 'asc' },
      include: {
        alerts: {
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const counts = {
      total: devices.length,
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    };

    for (const d of devices) {
      const status = d.status as DeviceStatus;
      counts[status] += 1;
    }

    const deviceRows = await Promise.all(
      devices.map(async (device) => {
        const latest = await telemetryService.getLatestByDevice(device.id);
        const lastSeenCandidates = Object.values(latest)
          .filter(Boolean)
          .map((m) => m!.timestamp.getTime());
        const lastSeen =
          lastSeenCandidates.length > 0
            ? new Date(Math.max(...lastSeenCandidates))
            : null;

        return {
          id: device.id,
          name: device.name,
          type: device.type,
          status: device.status,
          temperature: latest.temperature?.value ?? null,
          vibration: latest.vibration?.value ?? null,
          power: latest.power?.value ?? null,
          pressure: latest.pressure?.value ?? null,
          lastSeen,
          activeAlert: device.alerts[0]
            ? {
                id: device.alerts[0].id,
                title: device.alerts[0].title,
                severity: device.alerts[0].severity,
              }
            : null,
        };
      })
    );

    const latestAlerts = await prisma.alert.findMany({
      where: { resolved: false },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Sort by severity rank then recency
    latestAlerts.sort((a, b) => {
      const ai = SEVERITY_ORDER.indexOf(a.severity as AlertSeverity);
      const bi = SEVERITY_ORDER.indexOf(b.severity as AlertSeverity);
      if (ai !== bi) return ai - bi;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return {
      summary: counts,
      devices: deviceRows,
      latestAlerts,
      timestamp: new Date(),
    };
  }

  async getDevices() {
    return prisma.device.findMany({ orderBy: { name: 'asc' } });
  }

  async getDeviceDetail(id: string) {
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        alerts: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!device) {
      const error = new Error(`Device not found: ${id}`);
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    const latest = await telemetryService.getLatestByDevice(id);
    const [temperature, vibration, power, pressure] = await Promise.all([
      telemetryService.getHistory(id, 'temperature', 120),
      telemetryService.getHistory(id, 'vibration', 120),
      telemetryService.getHistory(id, 'power', 120),
      telemetryService.getHistory(id, 'pressure', 120),
    ]);

    return {
      device,
      latest,
      history: { temperature, vibration, power, pressure },
      activeAlerts: device.alerts.filter((a) => !a.resolved),
      alertHistory: device.alerts,
    };
  }

  async getAlerts(filters?: {
    severity?: AlertSeverity;
    acknowledged?: boolean;
    resolved?: boolean;
    deviceId?: string;
  }) {
    const where: {
      severity?: AlertSeverity;
      acknowledged?: boolean;
      resolved?: boolean;
      deviceId?: string;
    } = {
      resolved: filters?.resolved ?? false,
    };

    if (filters?.severity) where.severity = filters.severity;
    if (typeof filters?.acknowledged === 'boolean') {
      where.acknowledged = filters.acknowledged;
    }
    if (filters?.deviceId) where.deviceId = filters.deviceId;

    const alerts = await prisma.alert.findMany({
      where,
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });

    alerts.sort((a, b) => {
      const ai = SEVERITY_ORDER.indexOf(a.severity as AlertSeverity);
      const bi = SEVERITY_ORDER.indexOf(b.severity as AlertSeverity);
      if (ai !== bi) return ai - bi;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return alerts;
  }

  async acknowledgeAlert(id: string) {
    const alert = await prisma.alert.update({
      where: { id },
      data: { acknowledged: true },
      include: { device: true },
    });
    return alert;
  }
}

export const dashboardService = new DashboardService();

export type DeviceStatusCount = Record<DeviceStatus, number> & { total: number };
