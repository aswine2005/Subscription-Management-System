import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export interface PlanDistributionPoint {
  name: string;
  subscribers: number;
  revenue: number;
}

export interface PlanDistributionProps {
  data: PlanDistributionPoint[];
  height?: number;
}

export const PlanDistribution: React.FC<PlanDistributionProps> = ({
  data,
  height = 300,
}) => {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            vertical={false}
          />
          <XAxis
            dataKey="name"
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
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as PlanDistributionPoint;
                return (
                  <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl shadow-indigo-500/10 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">{label}</p>
                    <div className="flex items-center justify-between gap-4 py-0.5 text-indigo-600 dark:text-indigo-400 font-medium">
                      <span>Subscribers:</span>
                      <strong className="font-bold">{formatNumber(item.subscribers)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-0.5 text-purple-600 dark:text-purple-400 font-medium">
                      <span>Revenue:</span>
                      <strong className="font-bold">{formatCurrency(item.revenue)}</strong>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="subscribers"
            fill="#6366f1"
            radius={[6, 6, 0, 0]}
            name="Subscribers"
            barSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
