import { StatusBadge } from './StatusBadge';
import type { DeviceRow, DeviceStatus } from '../types';

interface DeviceTableProps {
  devices: DeviceRow[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
}

function formatMetric(value: number | null, digits = 1): string {
  if (value == null) return '—';
  return value.toFixed(digits);
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

export function DeviceTable({ devices, onSelect, selectedId }: DeviceTableProps) {
  if (devices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-industrial-border dark:text-industrial-muted">
        No devices match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-industrial-border dark:bg-industrial-panel">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-industrial-border dark:bg-slate-900/40 dark:text-industrial-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Device</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Temp °C</th>
            <th className="px-4 py-3 font-medium">Vibration</th>
            <th className="px-4 py-3 font-medium">Power W</th>
            <th className="px-4 py-3 font-medium">Last Seen</th>
            <th className="px-4 py-3 font-medium">Active Alert</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-industrial-border">
          {devices.map((device) => (
            <tr
              key={device.id}
              onClick={() => onSelect(device.id)}
              className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                selectedId === device.id ? 'bg-sky-50 dark:bg-sky-950/30' : ''
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900 dark:text-white">{device.name}</div>
                <div className="text-xs capitalize text-slate-500 dark:text-industrial-muted">
                  {device.type}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={device.status as DeviceStatus} />
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatMetric(device.temperature)}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatMetric(device.vibration, 2)}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {formatMetric(device.power, 0)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-industrial-muted">
                {formatLastSeen(device.lastSeen)}
              </td>
              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                {device.activeAlert ? (
                  <span className="line-clamp-1" title={device.activeAlert.title}>
                    {device.activeAlert.title}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
