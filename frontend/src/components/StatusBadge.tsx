import clsx from 'clsx';
import type { AlertSeverity, DeviceStatus } from '../types';

export function statusColor(status: DeviceStatus | AlertSeverity): string {
  switch (status) {
    case 'healthy':
    case 'info':
      return 'text-industrial-healthy';
    case 'warning':
      return 'text-industrial-warning';
    case 'critical':
      return 'text-industrial-critical';
    case 'offline':
      return 'text-industrial-offline';
    default:
      return 'text-slate-500';
  }
}

export function statusBg(status: DeviceStatus | AlertSeverity): string {
  switch (status) {
    case 'healthy':
    case 'info':
      return 'bg-emerald-500/15 border-emerald-500/40';
    case 'warning':
      return 'bg-yellow-500/15 border-yellow-500/40';
    case 'critical':
      return 'bg-red-500/15 border-red-500/40';
    case 'offline':
      return 'bg-gray-500/15 border-gray-500/40';
    default:
      return 'bg-slate-500/10 border-slate-500/30';
  }
}

export function StatusBadge({
  status,
  label,
}: {
  status: DeviceStatus | AlertSeverity;
  label?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide',
        statusBg(status),
        statusColor(status)
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', {
          'bg-industrial-healthy': status === 'healthy' || status === 'info',
          'bg-industrial-warning': status === 'warning',
          'bg-industrial-critical': status === 'critical',
          'bg-industrial-offline': status === 'offline',
        })}
      />
      {label ?? status}
    </span>
  );
}
