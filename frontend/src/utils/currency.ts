/** Brightloop is a single-currency INR workspace. Values are rupees, with two paise decimals. */
export const CURRENCY_CODE = 'USD' as const;
export const NUMBER_LOCALE = 'en-US';
const inr = new Intl.NumberFormat(NUMBER_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatCurrency(amount: number | string | undefined | null): string {
  const value = Number(amount ?? 0);
  return inr.format(Number.isFinite(value) ? value : 0);
}
export function formatCompactCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  const absolute = Math.abs(amount);
  const [divisor, suffix] =
    absolute >= 1e7
      ? [1e7, 'Cr']
      : absolute >= 1e5
        ? [1e5, 'L']
        : absolute >= 1e3
          ? [1e3, 'K']
          : [1, ''];
  const value = new Intl.NumberFormat(NUMBER_LOCALE, { maximumFractionDigits: 1 }).format(
    absolute / divisor,
  );
  return `${amount < 0 ? '−' : ''}₹${value}${suffix}`;
}
