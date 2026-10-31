import { format, formatDistanceToNow, parseISO } from 'date-fns';

export { formatCurrency, formatCompactCurrency, CURRENCY_CODE } from './currency';

export const formatDate = (
  dateString?: string | null,
  formatStr: string = 'MMM dd, yyyy',
): string => {
  if (!dateString) return '—';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, formatStr);
  } catch {
    return dateString;
  }
};

export const formatDateTime = (dateString?: string | null): string => {
  return formatDate(dateString, 'MMM dd, yyyy HH:mm');
};

export const formatRelativeTime = (dateString?: string | null): string => {
  if (!dateString) return '—';
  try {
    const utc =
      dateString.includes('T') && !/[Zz]|[+-]\d{2}:\d{2}$/.test(dateString)
        ? dateString + 'Z'
        : dateString;
    const date = parseISO(utc);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateString;
  }
};

export const formatBillingCycle = (cycle?: string): string => {
  if (!cycle) return '—';
  switch (cycle.toLowerCase()) {
    case 'monthly':
      return 'Monthly';
    case 'yearly':
      return 'Yearly';
    case 'weekly':
      return 'Weekly';
    case 'daily':
      return 'Daily';
    default:
      return cycle.charAt(0).toUpperCase() + cycle.slice(1);
  }
};

export const formatNumber = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || isNaN(Number(num))) return '0';
  return new Intl.NumberFormat('en-IN').format(Number(num));
};

export const formatPercent = (percent: number | string | undefined | null): string => {
  if (percent === undefined || percent === null || isNaN(Number(percent))) return '0%';
  const val = Number(percent);
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
};
