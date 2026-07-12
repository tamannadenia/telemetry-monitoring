import { acknowledgeAlert } from '../services/api';
import { StatusBadge } from './StatusBadge';
import type { Alert, AlertSeverity } from '../types';

interface AlertPanelProps {
  alerts: Alert[];
  severityFilter: AlertSeverity | 'all';
  onSeverityChange: (v: AlertSeverity | 'all') => void;
  onAcknowledged: () => void;
}

export function AlertPanel({
  alerts,
  severityFilter,
  onSeverityChange,
  onAcknowledged,
}: AlertPanelProps) {
  const filtered =
    severityFilter === 'all'
      ? alerts
      : alerts.filter((a) => a.severity === severityFilter);

  async function handleAck(id: string) {
    try {
      await acknowledgeAlert(id);
      onAcknowledged();
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-industrial-border dark:bg-industrial-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-industrial-border">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
          Active Alerts
        </h2>
        <select
          value={severityFilter}
          onChange={(e) => onSeverityChange(e.target.value as AlertSeverity | 'all')}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-industrial-border dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="offline">Offline</option>
          <option value="info">Info</option>
        </select>
      </div>

      <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-industrial-border">
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500 dark:text-industrial-muted">
            No active alerts
          </li>
        )}
        {filtered.map((alert) => (
          <li key={alert.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={alert.severity} />
                  <span className="text-xs font-medium text-slate-500 dark:text-industrial-muted">
                    {alert.device.name}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{alert.title}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-industrial-muted">
                  {alert.description}
                </p>
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
              {!alert.acknowledged && (
                <button
                  type="button"
                  onClick={() => handleAck(alert.id)}
                  className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-industrial-border dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Ack
                </button>
              )}
              {alert.acknowledged && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                  Acked
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
