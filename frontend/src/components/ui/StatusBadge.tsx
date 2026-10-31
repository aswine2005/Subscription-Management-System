import React from 'react';
import clsx from 'clsx';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  dot = true,
  className,
}) => {
  const normalized = (status || '').toLowerCase().trim();

  // Color mappings
  let styles = {
    bg: 'bg-slate-100 ',
    text: 'text-slate-700 ',
    border: 'border-slate-300 ',
    dot: 'bg-slate-400',
  };

  switch (normalized) {
    case 'active':
    case 'paid':
    case 'completed':
      styles = {
        bg: 'bg-emerald-50 ',
        text: 'text-emerald-700 ',
        border: 'border-emerald-200 ',
        dot: 'bg-emerald-500',
      };
      break;

    case 'confirmed':
      styles = {
        bg: 'bg-amber-50 ',
        text: 'text-amber-700 ',
        border: 'border-amber-200 ',
        dot: 'bg-amber-500',
      };
      break;

    case 'quotation':
    case 'processing':
      styles = {
        bg: 'bg-blue-50 ',
        text: 'text-blue-700 ',
        border: 'border-blue-200 ',
        dot: 'bg-blue-500',
      };
      break;

    case 'paused':
      styles = {
        bg: 'bg-orange-50 ',
        text: 'text-orange-700 ',
        border: 'border-orange-200 ',
        dot: 'bg-orange-500',
      };
      break;

    case 'closed':
    case 'cancelled':
    case 'failed':
      styles = {
        bg: 'bg-rose-50 ',
        text: 'text-rose-700 ',
        border: 'border-rose-200 ',
        dot: 'bg-rose-500',
      };
      break;

    case 'overdue':
    case 'expired':
      styles = {
        bg: 'bg-amber-500/10 ',
        text: 'text-amber-600 font-semibold',
        border: 'border-amber-300 ',
        dot: 'bg-amber-500 animate-pulse',
      };
      break;

    case 'draft':
    case 'archived':
    case 'disabled':
    case 'inactive':
      styles = {
        bg: 'bg-slate-100 ',
        text: 'text-slate-600 ',
        border: 'border-slate-200 ',
        dot: 'bg-slate-400',
      };
      break;

    case 'service':
      styles = {
        bg: 'bg-purple-50 ',
        text: 'text-purple-700 ',
        border: 'border-purple-200 ',
        dot: 'bg-purple-500',
      };
      break;

    case 'addon':
      styles = {
        bg: 'bg-cyan-50 ',
        text: 'text-cyan-700 ',
        border: 'border-cyan-200 ',
        dot: 'bg-cyan-500',
      };
      break;

    case 'software':
      styles = {
        bg: 'bg-indigo-50 ',
        text: 'text-indigo-700 ',
        border: 'border-indigo-200 ',
        dot: 'bg-indigo-500',
      };
      break;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border uppercase tracking-wider capitalize',
        styles.bg,
        styles.text,
        styles.border,
        sizeClasses[size],
        className,
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', styles.dot)} />}
      <span>{status}</span>
    </span>
  );
};
