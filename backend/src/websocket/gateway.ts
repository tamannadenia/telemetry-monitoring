import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

/**
 * Socket.IO gateway for real-time dashboard updates.
 * Emits telemetry, alert, and device-status events to connected clients.
 */
export class WebSocketGateway {
  private io: Server | null = null;

  /**
   * Attach Socket.IO to the HTTP server and configure CORS.
   */
  initialize(httpServer: HttpServer, corsOrigin: string): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST', 'PATCH'],
      },
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`[ws] Client connected: ${socket.id}`);

      socket.on('subscribe:device', (deviceId: string) => {
        socket.join(`device:${deviceId}`);
      });

      socket.on('unsubscribe:device', (deviceId: string) => {
        socket.leave(`device:${deviceId}`);
      });

      socket.on('disconnect', () => {
        console.log(`[ws] Client disconnected: ${socket.id}`);
      });
    });
  }

  /** Broadcast a new telemetry reading to all clients and the device room. */
  emitTelemetry(payload: unknown): void {
    this.io?.emit('telemetry:new', payload);
    const reading = payload as { deviceId?: string };
    if (reading.deviceId) {
      this.io?.to(`device:${reading.deviceId}`).emit('telemetry:device', payload);
    }
  }

  /** Broadcast alert create / resolve / acknowledge events. */
  emitAlert(payload: unknown): void {
    this.io?.emit('alert:update', payload);
  }

  /** Broadcast device status changes (healthy / warning / critical / offline). */
  emitDeviceStatus(payload: unknown): void {
    this.io?.emit('device:status', payload);
  }

  /** Broadcast a refreshed dashboard summary. */
  emitDashboard(payload: unknown): void {
    this.io?.emit('dashboard:update', payload);
  }
}

/** Singleton gateway used across services via dependency injection. */
export const webSocketGateway = new WebSocketGateway();
