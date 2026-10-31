import React from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from './Card';

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
  iconColor = 'indigo',
}) => {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change !== undefined && change === 0;

  const colorStyles = {
    indigo: 'from-indigo-500 to-indigo-600 text-white shadow-indigo-500/20',
    purple: 'from-purple-500 to-purple-600 text-white shadow-purple-500/20',
    emerald: 'from-emerald-500 to-emerald-600 text-white shadow-emerald-500/20',
    amber: 'from-amber-500 to-amber-600 text-white shadow-amber-500/20',
    rose: 'from-rose-500 to-rose-600 text-white shadow-rose-500/20',
  };

  return (
    <Card hover className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">
            {value}
          </h3>
        </div>
        <div
          className={clsx(
            'p-3 rounded-2xl bg-gradient-to-br shadow-lg flex items-center justify-center shrink-0',
            colorStyles[iconColor]
          )}
        >
          {icon}
        </div>
      </div>

      {change !== undefined && (
        <div className="flex items-center gap-1.5 mt-4 text-xs">
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold',
              isPositive && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
              isNegative && 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
              isNeutral && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {isPositive && <TrendingUp className="w-3.5 h-3.5" />}
            {isNegative && <TrendingDown className="w-3.5 h-3.5" />}
            {isNeutral && <Minus className="w-3.5 h-3.5" />}
            <span>
              {isPositive ? '+' : ''}
              {change.toFixed(1)}%
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">{changeLabel}</span>
        </div>
      )}
    </Card>
  );
};
