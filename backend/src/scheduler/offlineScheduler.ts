import prisma from '../database/prisma';
import { analysisService } from '../analyzers/analysisService';
import { dashboardService } from '../services/dashboardService';
import { webSocketGateway } from '../websocket/gateway';

/**
 * Periodic job that marks devices offline when they stop reporting.
 * Default threshold: 2 minutes without any telemetry.
 */
export class OfflineScheduler {
  private timer: NodeJS.Timeout | null = null;

  start(intervalMs: number, thresholdMs: number): void {
    if (this.timer) return;

    console.log(
      `[scheduler] Offline check every ${intervalMs}ms (threshold ${thresholdMs}ms)`
    );

    this.timer = setInterval(() => {
      void this.checkOfflineDevices(thresholdMs);
    }, intervalMs);

    // Run once shortly after boot
    void this.checkOfflineDevices(thresholdMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkOfflineDevices(thresholdMs: number): Promise<void> {
    try {
      const devices = await prisma.device.findMany();
      const cutoff = new Date(Date.now() - thresholdMs);

      for (const device of devices) {
        const latest = await prisma.telemetry.findFirst({
          where: { deviceId: device.id },
          orderBy: { timestamp: 'desc' },
        });

        const isStale = !latest || latest.timestamp < cutoff;

        if (isStale && device.status !== 'offline') {
          console.log(`[scheduler] Marking ${device.name} offline`);
          await analysisService.markOffline(device.id);
        }
      }

      const summary = await dashboardService.getSummary();
      webSocketGateway.emitDashboard(summary);
    } catch (err) {
      console.error('[scheduler] Offline check failed:', err);
    }
  }
}

export const offlineScheduler = new OfflineScheduler();
