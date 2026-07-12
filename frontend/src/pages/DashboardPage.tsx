import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertPanel } from '../components/AlertPanel';
import { DeviceTable } from '../components/DeviceTable';
import { SummaryCard } from '../components/SummaryCards';
import { fetchDashboard } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import type { AlertSeverity, DashboardSummary, DeviceStatus } from '../types';

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const summary = await fetchDashboard();
      setData(summary);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 10000);
    return () => clearInterval(interval);
  }, [load]);

  useSocket({
    onDashboard: (payload) => {
      setData(payload as DashboardSummary);
      setLastRefresh(new Date());
    },
    onAlert: () => void load(),
    onDeviceStatus: () => void load(),
  });

  const filteredDevices = useMemo(() => {
    if (!data) return [];
    return data.devices.filter((d) => {
      const matchesSearch =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.type.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
        <p className="font-medium">Unable to reach the API</p>
        <p className="mt-1 text-sm">{error}</p>
        <p className="mt-2 text-sm opacity-80">
          Ensure the backend is running on port 4000 and PostgreSQL is available.
        </p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-slate-500 dark:text-industrial-muted">Loading fleet telemetry…</p>;
  }

  const { summary, latestAlerts } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Fleet Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-industrial-muted">
            Live industrial equipment health and predictive alerts
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-industrial-muted">
          {lastRefresh && (
            <span className="font-mono">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-slate-300 px-2 py-1 hover:bg-white dark:border-industrial-border dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total Devices" value={summary.total} status="total" />
        <SummaryCard label="Healthy" value={summary.healthy} status="healthy" />
        <SummaryCard label="Warning" value={summary.warning} status="warning" />
        <SummaryCard label="Critical" value={summary.critical} status="critical" />
        <SummaryCard label="Offline" value={summary.offline} status="offline" />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search devices…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-industrial-border dark:bg-industrial-panel dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DeviceStatus | 'all')}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-industrial-border dark:bg-industrial-panel dark:text-white"
        >
          <option value="all">All statuses</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DeviceTable
            devices={filteredDevices}
            onSelect={(id) => navigate(`/devices/${id}`)}
          />
        </div>
        <AlertPanel
          alerts={latestAlerts}
          severityFilter={severityFilter}
          onSeverityChange={setSeverityFilter}
          onAcknowledged={() => void load()}
        />
      </div>
    </div>
  );
}
