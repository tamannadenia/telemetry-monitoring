import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { MetricPoint } from '../types';

interface TelemetryChartProps {
  title: string;
  unit: string;
  data: MetricPoint[];
  color: string;
  warningAt?: number;
  criticalAt?: number;
}

export function TelemetryChart({
  title,
  unit,
  data,
  color,
  warningAt,
  criticalAt,
}: TelemetryChartProps) {
  const chartData = data.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString(),
    value: Number(p.value.toFixed(2)),
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-industrial-border dark:bg-industrial-panel">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        <span className="text-xs text-slate-500 dark:text-industrial-muted">{unit}</span>
      </div>
      <div className="h-48 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#33415533" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#1a2332',
                  border: '1px solid #2a3a4d',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              {warningAt != null && (
                <ReferenceLine y={warningAt} stroke="#eab308" strokeDasharray="4 4" />
              )}
              {criticalAt != null && (
                <ReferenceLine y={criticalAt} stroke="#ef4444" strokeDasharray="4 4" />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
