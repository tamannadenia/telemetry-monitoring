/** Shared domain types — SQLite stores these as plain strings. */

export type DeviceStatus = 'healthy' | 'warning' | 'critical' | 'offline';
export type DeviceType = 'cooler' | 'pump' | 'motor';
export type MetricType = 'temperature' | 'vibration' | 'power' | 'pressure';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'offline';

export const DeviceStatus = {
  healthy: 'healthy',
  warning: 'warning',
  critical: 'critical',
  offline: 'offline',
} as const;

export const DeviceType = {
  cooler: 'cooler',
  pump: 'pump',
  motor: 'motor',
} as const;

export const MetricType = {
  temperature: 'temperature',
  vibration: 'vibration',
  power: 'power',
  pressure: 'pressure',
} as const;

export const AlertSeverity = {
  info: 'info',
  warning: 'warning',
  critical: 'critical',
  offline: 'offline',
} as const;

export const METRIC_VALUES = Object.values(MetricType) as MetricType[];
export const DEVICE_STATUS_VALUES = Object.values(DeviceStatus) as DeviceStatus[];
export const ALERT_SEVERITY_VALUES = Object.values(AlertSeverity) as AlertSeverity[];
