import clsx from 'clsx';
import type { DeviceStatus } from '../types';

interface SummaryCardProps {
  label: string;
  value: number;
  status: DeviceStatus | 'total';
}

const accent: Record<SummaryCardProps['status'], string> = {
  total: 'border-l-sky-500',
  healthy: 'border-l-industrial-healthy',
  warning: 'border-l-industrial-warning',
  critical: 'border-l-industrial-critical',
  offline: 'border-l-industrial-offline',
};

export function SummaryCard({ label, value, status }: SummaryCardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-industrial-border dark:bg-industrial-panel',
        'border-l-4',
        accent[status]
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-industrial-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
