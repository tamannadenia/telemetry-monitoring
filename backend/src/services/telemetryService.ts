import { z } from 'zod';
import prisma from '../database/prisma';
import { analysisService } from '../analyzers/analysisService';
import { webSocketGateway } from '../websocket/gateway';
import { dashboardService } from './dashboardService';
import { METRIC_VALUES, MetricType } from '../types/domain';

/** Zod schema for incoming telemetry POST bodies. */
export const telemetrySchema = z.object({
  deviceId: z.string().uuid(),
  metric: z.enum(METRIC_VALUES as [MetricType, ...MetricType[]]),
  value: z.number().finite(),
  timestamp: z.coerce.date().optional(),
});

export type TelemetryPayload = z.infer<typeof telemetrySchema>;

/** Debounce full dashboard broadcasts under high ingest load. */
let dashboardBroadcastTimer: NodeJS.Timeout | null = null;

function scheduleDashboardBroadcast(): void {
  if (dashboardBroadcastTimer) return;
  dashboardBroadcastTimer = setTimeout(async () => {
    dashboardBroadcastTimer = null;
    try {
      const summary = await dashboardService.getSummary();
      webSocketGateway.emitDashboard(summary);
    } catch (err) {
      console.error('[telemetry] dashboard broadcast failed:', err);
    }
  }, 1000);
}

/**
 * Telemetry ingestion service: validate, store, analyze, and broadcast.
 */
export class TelemetryService {
  async ingest(payload: TelemetryPayload) {
    const device = await prisma.device.findUnique({
      where: { id: payload.deviceId },
    });

    if (!device) {
      const error = new Error(`Device not found: ${payload.deviceId}`);
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    const reading = await prisma.telemetry.create({
      data: {
        deviceId: payload.deviceId,
        metric: payload.metric,
        value: payload.value,
        timestamp: payload.timestamp ?? new Date(),
      },
      include: { device: true },
    });

    // Run analysis engine against the new reading
    await analysisService.analyzeReading({
      deviceId: reading.deviceId,
      metric: reading.metric as MetricType,
      value: reading.value,
      timestamp: reading.timestamp,
    });

    // Re-read status after analysis may have changed it
    const fresh = await prisma.device.findUnique({ where: { id: reading.deviceId } });

    webSocketGateway.emitTelemetry({
      id: reading.id,
      deviceId: reading.deviceId,
      deviceName: reading.device.name,
      metric: reading.metric,
      value: reading.value,
      timestamp: reading.timestamp,
      status: fresh?.status ?? reading.device.status,
    });

    scheduleDashboardBroadcast();

    return reading;
  }

  /**
   * Latest value per metric for a device (used by device detail / table).
   */
  async getLatestByDevice(deviceId: string) {
    const metrics = Object.values(MetricType);
    const latest: Record<string, { value: number; timestamp: Date } | null> = {};

    await Promise.all(
      metrics.map(async (metric) => {
        const row = await prisma.telemetry.findFirst({
          where: { deviceId, metric },
          orderBy: { timestamp: 'desc' },
        });
        latest[metric] = row
          ? { value: row.value, timestamp: row.timestamp }
          : null;
      })
    );

    return latest;
  }

  /** Historical series for charts (default last hour, up to `limit` points). */
  async getHistory(
    deviceId: string,
    metric: MetricType,
    limit = 60
  ): Promise<{ timestamp: Date; value: number }[]> {
    const rows = await prisma.telemetry.findMany({
      where: { deviceId, metric },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: { timestamp: true, value: true },
    });

    return rows.reverse();
  }
}

export const telemetryService = new TelemetryService();
