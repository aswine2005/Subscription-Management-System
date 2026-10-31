import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
export interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';
}
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  changeLabel = 'from last month',
  icon,
}) => (
  <div className="panel p-5">
    <div className="flex justify-between text-[11px] text-slate-500">
      <span>{label}</span>
      <span className="text-slate-300 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
    </div>
    <div className="text-3xl font-medium tracking-tight text-slate-900 mt-5">{value}</div>
    {change !== undefined && (
      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-3">
        {change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{' '}
        {change > 0 ? '+' : ''}
        {change.toFixed(1)}% {changeLabel}
      </div>
    )}
  </div>
);
