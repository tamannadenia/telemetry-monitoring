import axios from 'axios';
import type { Alert, AlertSeverity, DashboardSummary, DeviceDetail } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

export async function fetchDashboard(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/dashboard');
  return data;
}

export async function fetchDeviceDetail(id: string): Promise<DeviceDetail> {
  const { data } = await api.get<DeviceDetail>(`/devices/${id}`);
  return data;
}

export async function fetchAlerts(params?: {
  severity?: AlertSeverity;
  acknowledged?: boolean;
  resolved?: boolean;
  deviceId?: string;
}): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>('/alerts', { params });
  return data;
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  const { data } = await api.patch<Alert>(`/alerts/${id}/acknowledge`);
  return data;
}

export default api;
