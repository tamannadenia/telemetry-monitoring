import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

/**
 * Shared Socket.IO connection for live dashboard updates.
 */
let sharedSocket: Socket | null = null;

function getSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return sharedSocket;
}

export function useSocket(
  handlers: {
    onDashboard?: (payload: unknown) => void;
    onTelemetry?: (payload: unknown) => void;
    onAlert?: (payload: unknown) => void;
    onDeviceStatus?: (payload: unknown) => void;
  },
  enabled = true
): Socket | null {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();

    const onDashboard = (p: unknown) => handlersRef.current.onDashboard?.(p);
    const onTelemetry = (p: unknown) => handlersRef.current.onTelemetry?.(p);
    const onAlert = (p: unknown) => handlersRef.current.onAlert?.(p);
    const onDeviceStatus = (p: unknown) => handlersRef.current.onDeviceStatus?.(p);

    socket.on('dashboard:update', onDashboard);
    socket.on('telemetry:new', onTelemetry);
    socket.on('alert:update', onAlert);
    socket.on('device:status', onDeviceStatus);

    return () => {
      socket.off('dashboard:update', onDashboard);
      socket.off('telemetry:new', onTelemetry);
      socket.off('alert:update', onAlert);
      socket.off('device:status', onDeviceStatus);
    };
  }, [enabled]);

  return enabled ? getSocket() : null;
}

export function subscribeDevice(deviceId: string): void {
  getSocket().emit('subscribe:device', deviceId);
}

export function unsubscribeDevice(deviceId: string): void {
  getSocket().emit('unsubscribe:device', deviceId);
}
