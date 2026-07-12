import { Prisma } from '@prisma/client';
import prisma from '../database/prisma';
import { webSocketGateway } from '../websocket/gateway';
import {
  AlertSeverity,
  DeviceStatus,
  MetricType,
} from '../types/domain';

export interface TelemetryInput {
  deviceId: string;
  metric: MetricType;
  value: number;
  timestamp?: Date;
}

/** Thresholds used by the analysis engine. */
export const THRESHOLDS = {
  temperature: { warning: 45, critical: 60 },
  vibration: { warning: 1.5, critical: 2.5 },
  power: { normalMin: 100, normalMax: 300 },
  pressure: { normalMin: 40, normalMax: 80 },
} as const;

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  offline: 3,
};

/**
 * Analysis engine: evaluates each incoming reading for thresholds,
 * trends, noise, sensor failure, and auto-resolves recovered alerts.
 */
export class AnalysisService {
  /**
   * Process a newly stored telemetry reading.
   * Returns any newly created alerts (may be empty).
   */
  async analyzeReading(input: TelemetryInput): Promise<void> {
    const { deviceId, metric, value } = input;

    // Any fresh reading means the device is online — clear offline state first
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (device?.status === DeviceStatus.offline) {
      await this.clearOffline(deviceId);
    }

    // Duplicate / noise / sensor-failure checks use recent history
    const recent = await prisma.telemetry.findMany({
      where: { deviceId, metric },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    // Recent[0] is the reading we just stored; prior readings start at index 1
    const previous = recent.slice(1);

    if (this.isDuplicate(value, previous)) {
      await this.refreshDeviceStatus(deviceId);
      return;
    }

    if (metric === MetricType.temperature || metric === MetricType.vibration) {
      if (this.isIsolatedSpike(value, previous, metric)) {
        // Ignore isolated spikes that immediately return to normal
        await this.autoResolve(deviceId, metric, value);
        await this.refreshDeviceStatus(deviceId);
        return;
      }
    }

    // Sensor failure: repeated zeros
    if (this.isSensorFailure(value, previous)) {
      await this.raiseAlert({
        deviceId,
        severity: AlertSeverity.warning,
        title: 'Possible sensor failure',
        description: `${metric} has remained at zero for multiple consecutive readings.`,
      });
    }

    // Threshold evaluation for temperature & vibration
    if (metric === MetricType.temperature) {
      await this.evaluateThresholds(deviceId, metric, value, THRESHOLDS.temperature);
      await this.evaluateTrend(deviceId, recent.map((r) => r.value));
    }

    if (metric === MetricType.vibration) {
      await this.evaluateThresholds(deviceId, metric, value, THRESHOLDS.vibration);
    }

    // Auto-resolve when values return to normal
    await this.autoResolve(deviceId, metric, value);

    // Refresh device aggregate status from active alerts
    await this.refreshDeviceStatus(deviceId);
  }

  /** Ignore exact duplicate consecutive values (within tiny epsilon). */
  private isDuplicate(value: number, previous: { value: number }[]): boolean {
    if (previous.length === 0) return false;
    return Math.abs(previous[0].value - value) < 1e-9;
  }

  /**
   * Noise filter: current reading is critical/warning, but the prior
   * reading and (if available) the one before that were both normal —
   * treat as an isolated spike only when we see a return-to-normal pattern
   * on the *next* cycle. Here we filter when the spike is sandwiched:
   * normal → spike → normal is handled by checking if previous was normal
   * AND the reading before previous was also elevated (i.e. we already alerted)
   * OR: previous was normal and current is spike — wait one more reading.
   *
   * Practical approach: if previous reading was normal and current is elevated,
   * do not alert yet (defer). If previous was elevated and current is elevated,
   * alert. If previous was elevated and current is normal, resolve.
   */
  private isIsolatedSpike(
    value: number,
    previous: { value: number }[],
    metric: MetricType
  ): boolean {
    if (previous.length < 1) return false;

    const warning =
      metric === MetricType.temperature
        ? THRESHOLDS.temperature.warning
        : THRESHOLDS.vibration.warning;

    const prev = previous[0].value;
    const isCurrentElevated = value > warning;
    const isPrevNormal = prev <= warning;

    // First elevated reading after normal — wait for confirmation (noise filter)
    if (isCurrentElevated && isPrevNormal) {
      return true;
    }

    return false;
  }

  /** Detect repeated zero values suggesting a failed sensor. */
  private isSensorFailure(value: number, previous: { value: number }[]): boolean {
    if (value !== 0) return false;
    const zeros = previous.filter((r) => r.value === 0).length;
    // Current + at least 4 prior zeros = 5 consecutive
    return zeros >= 4;
  }

  private async evaluateThresholds(
    deviceId: string,
    metric: MetricType,
    value: number,
    limits: { warning: number; critical: number }
  ): Promise<void> {
    if (value > limits.critical) {
      await this.raiseAlert({
        deviceId,
        severity: AlertSeverity.critical,
        title: `Critical ${metric}`,
        description: `${metric} is ${value.toFixed(2)}, exceeding critical threshold of ${limits.critical}.`,
      });
    } else if (value > limits.warning) {
      await this.raiseAlert({
        deviceId,
        severity: AlertSeverity.warning,
        title: `Warning ${metric}`,
        description: `${metric} is ${value.toFixed(2)}, exceeding warning threshold of ${limits.warning}.`,
      });
    }
  }

  /**
   * Trend detection: last five temperature readings continuously increase.
   * `readings` is ordered newest-first from the DB query.
   */
  private async evaluateTrend(deviceId: string, readingsNewestFirst: number[]): Promise<void> {
    if (readingsNewestFirst.length < 5) return;

    const lastFive = readingsNewestFirst.slice(0, 5).reverse(); // oldest → newest
    let rising = true;
    for (let i = 1; i < lastFive.length; i++) {
      if (lastFive[i] <= lastFive[i - 1]) {
        rising = false;
        break;
      }
    }

    if (rising) {
      await this.raiseAlert({
        deviceId,
        severity: AlertSeverity.warning,
        title: 'Temperature rising continuously',
        description: `Last five temperature readings are strictly increasing: ${lastFive.map((v) => v.toFixed(1)).join(' → ')}.`,
      });
    }
  }

  /**
   * Create an alert only if an equivalent active alert does not already exist.
   */
  async raiseAlert(params: {
    deviceId: string;
    severity: AlertSeverity;
    title: string;
    description: string;
  }): Promise<void> {
    const existing = await prisma.alert.findFirst({
      where: {
        deviceId: params.deviceId,
        title: params.title,
        resolved: false,
      },
    });

    if (existing) {
      // Upgrade severity in place if the new one is worse
      if (SEVERITY_RANK[params.severity] > SEVERITY_RANK[existing.severity as AlertSeverity]) {
        const updated = await prisma.alert.update({
          where: { id: existing.id },
          data: {
            severity: params.severity,
            description: params.description,
          },
          include: { device: true },
        });
        webSocketGateway.emitAlert({ action: 'updated', alert: updated });
      }
      return;
    }

    const alert = await prisma.alert.create({
      data: {
        deviceId: params.deviceId,
        severity: params.severity,
        title: params.title,
        description: params.description,
      },
      include: { device: true },
    });

    webSocketGateway.emitAlert({ action: 'created', alert });
  }

  /**
   * Resolve threshold / trend / sensor-failure alerts when metric returns to normal.
   */
  private async autoResolve(
    deviceId: string,
    metric: MetricType,
    value: number
  ): Promise<void> {
    const titlesToResolve: string[] = [];

    if (metric === MetricType.temperature) {
      if (value <= THRESHOLDS.temperature.warning) {
        titlesToResolve.push(
          'Critical temperature',
          'Warning temperature',
          'Temperature rising continuously'
        );
      } else if (value <= THRESHOLDS.temperature.critical) {
        titlesToResolve.push('Critical temperature');
      }
    }

    if (metric === MetricType.vibration) {
      if (value <= THRESHOLDS.vibration.warning) {
        titlesToResolve.push('Critical vibration', 'Warning vibration');
      } else if (value <= THRESHOLDS.vibration.critical) {
        titlesToResolve.push('Critical vibration');
      }
    }

    if (value !== 0) {
      titlesToResolve.push('Possible sensor failure');
    }

    if (titlesToResolve.length === 0) return;

    const active = await prisma.alert.findMany({
      where: {
        deviceId,
        resolved: false,
        title: { in: titlesToResolve },
      },
    });

    for (const alert of active) {
      const resolved = await prisma.alert.update({
        where: { id: alert.id },
        data: { resolved: true, resolvedAt: new Date() },
        include: { device: true },
      });
      webSocketGateway.emitAlert({ action: 'resolved', alert: resolved });
    }
  }

  /**
   * Derive device status from the highest-severity active alert.
   */
  async refreshDeviceStatus(deviceId: string): Promise<void> {
    const activeAlerts = await prisma.alert.findMany({
      where: { deviceId, resolved: false },
    });

    let nextStatus: DeviceStatus = DeviceStatus.healthy;

    for (const alert of activeAlerts) {
      if (alert.severity === AlertSeverity.offline) {
        nextStatus = DeviceStatus.offline;
        break;
      }
      if (alert.severity === AlertSeverity.critical) {
        nextStatus = DeviceStatus.critical;
      } else if (
        alert.severity === AlertSeverity.warning &&
        nextStatus !== DeviceStatus.critical
      ) {
        nextStatus = DeviceStatus.warning;
      }
    }

    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { status: nextStatus },
    });

    webSocketGateway.emitDeviceStatus({
      deviceId,
      status: updated.status,
      name: updated.name,
    });
  }

  /** Mark a device offline and raise an Offline alert. */
  async markOffline(deviceId: string): Promise<void> {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.offline },
    });

    await this.raiseAlert({
      deviceId,
      severity: AlertSeverity.offline,
      title: 'Device offline',
      description: 'Device has not reported telemetry for more than two minutes.',
    });

    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    webSocketGateway.emitDeviceStatus({
      deviceId,
      status: DeviceStatus.offline,
      name: device?.name,
    });
  }

  /** Clear offline status/alerts when fresh data arrives. */
  private async clearOffline(deviceId: string): Promise<void> {
    const offlineAlerts = await prisma.alert.findMany({
      where: {
        deviceId,
        resolved: false,
        title: 'Device offline',
      },
    });

    for (const alert of offlineAlerts) {
      const resolved = await prisma.alert.update({
        where: { id: alert.id },
        data: { resolved: true, resolvedAt: new Date() },
        include: { device: true },
      });
      webSocketGateway.emitAlert({ action: 'resolved', alert: resolved });
    }
  }
}

export const analysisService = new AnalysisService();

/** Helper type for Prisma alert with device include. */
export type AlertWithDevice = Prisma.AlertGetPayload<{ include: { device: true } }>;
