export type DeviceStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type DeviceType = 'cooler' | 'pump' | 'motor';
export type MetricType = 'temperature' | 'vibration' | 'power' | 'pressure';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'offline';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  createdAt: string;
}

export interface ActiveAlertSummary {
  id: string;
  title: string;
  severity: AlertSeverity;
}

export interface DeviceRow {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  temperature: number | null;
  vibration: number | null;
  power: number | null;
  pressure: number | null;
  lastSeen: string | null;
  activeAlert: ActiveAlertSummary | null;
}

export interface Alert {
  id: string;
  deviceId: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  acknowledged: boolean;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  device: Device;
}

export interface DashboardSummary {
  summary: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    offline: number;
  };
  devices: DeviceRow[];
  latestAlerts: Alert[];
  timestamp: string;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface DeviceDetail {
  device: Device & {
    alerts: Omit<Alert, 'device'>[];
  };
  latest: Record<MetricType, { value: number; timestamp: string } | null>;
  history: Record<MetricType, MetricPoint[]>;
  activeAlerts: Omit<Alert, 'device'>[];
  alertHistory: Omit<Alert, 'device'>[];
}
