import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  projected?: number;
}

export interface RevenueChartProps {
  data: RevenueDataPoint[];
  height?: number;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, height = 320 }) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            stroke="currentColor"
            className="text-[11px] text-slate-400 dark:text-slate-500"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="currentColor"
            className="text-[11px] text-slate-400 dark:text-slate-500"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl shadow-indigo-500/10 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                      <span>Revenue: {formatCurrency(payload[0]?.value as number)}</span>
                    </div>
                    {payload[1] && (
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span>Projected: {formatCurrency(payload[1]?.value as number)}</span>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6366f1"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#revenueGradient)"
          />
          {data[0]?.projected !== undefined && (
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#projectedGradient)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
