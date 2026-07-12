import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TelemetryChart } from '../charts/TelemetryChart';
import { StatusBadge } from '../components/StatusBadge';
import { fetchDeviceDetail } from '../services/api';
import { subscribeDevice, unsubscribeDevice, useSocket } from '../hooks/useSocket';
import type { DeviceDetail } from '../types';

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    try {
      const data = await fetchDeviceDetail(id);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load device');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    subscribeDevice(id);
    return () => unsubscribeDevice(id);
  }, [id]);

  useSocket({
    onTelemetry: (payload) => {
      const p = payload as { deviceId?: string };
      if (p.deviceId === id) void load();
    },
    onAlert: () => void load(),
    onDeviceStatus: (payload) => {
      const p = payload as { deviceId?: string };
      if (p.deviceId === id) void load();
    },
  });

  if (loading && !detail) {
    return <p className="p-6 text-slate-500">Loading device…</p>;
  }

  if (error || !detail) {
    return (
      <div className="p-6">
        <p className="text-red-500">{error ?? 'Device not found'}</p>
        <Link to="/" className="mt-2 inline-block text-sky-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const { device, latest, history, activeAlerts, alertHistory } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            ← Fleet dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {device.name}
          </h1>
          <p className="mt-1 text-sm capitalize text-slate-500 dark:text-industrial-muted">
            {device.type} · ID {device.id.slice(0, 8)}…
          </p>
        </div>
        <StatusBadge status={device.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ['temperature', '°C', 1],
            ['vibration', '', 2],
            ['power', 'W', 0],
            ['pressure', 'PSI', 1],
          ] as const
        ).map(([metric, unit, digits]) => (
          <div
            key={metric}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-industrial-border dark:bg-industrial-panel"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-industrial-muted">
              {metric}
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-white">
              {latest[metric] != null
                ? `${latest[metric]!.value.toFixed(digits)}${unit ? ` ${unit}` : ''}`
                : '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TelemetryChart
          title="Temperature"
          unit="°C"
          data={history.temperature}
          color="#38bdf8"
          warningAt={45}
          criticalAt={60}
        />
        <TelemetryChart
          title="Vibration"
          unit="mm/s"
          data={history.vibration}
          color="#a78bfa"
          warningAt={1.5}
          criticalAt={2.5}
        />
        <TelemetryChart title="Power" unit="W" data={history.power} color="#34d399" />
        <TelemetryChart title="Pressure" unit="PSI" data={history.pressure} color="#fbbf24" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-industrial-border dark:bg-industrial-panel">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Active Alerts
          </h2>
          {activeAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">None</p>
          ) : (
            <ul className="space-y-2">
              {activeAlerts.map((a) => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <StatusBadge status={a.severity} />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-industrial-border dark:bg-industrial-panel">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Alert History
          </h2>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {alertHistory.map((a) => (
              <li
                key={a.id}
                className="border-b border-slate-100 pb-2 text-sm last:border-0 dark:border-industrial-border"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.severity} />
                  {a.resolved && (
                    <span className="text-[10px] uppercase text-slate-400">Resolved</span>
                  )}
                </div>
                <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{a.title}</p>
                <p className="font-mono text-[10px] text-slate-400">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
