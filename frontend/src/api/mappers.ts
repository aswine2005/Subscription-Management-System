import { User, Product, Plan, Subscription, Invoice, PaymentRecord, Discount } from '../types';
export const mapUser = (u: any): User => ({
  ...u,
  id: String(u.id),
  name: u.full_name,
  status: u.is_active ? 'active' : 'inactive',
});
export const mapProduct = (p: any): Product => ({
  ...p,
  id: String(p.id),
  status: p.is_active ? 'active' : 'archived',
  variants: p.variants
    .filter((v: any) => v.is_active)
    .map((v: any) => ({ ...v, id: String(v.id) })),
});
export const mapPlan = (p: any): Plan => ({
  ...p,
  id: String(p.id),
  product_id: String(p.product_id),
  product_name: p.product?.name,
  min_qty: p.min_quantity,
  status: p.is_active ? 'active' : 'archived',
});
export const mapSubscription = (s: any): Subscription => {
  const subtotal = s.lines.reduce((a: number, l: any) => a + l.subtotal, 0);
  return {
    ...s,
    id: String(s.id),
    customer_id: String(s.customer_id),
    customer_name: s.customer?.full_name,
    customer_email: s.customer?.email,
    allow_pause: s.plan?.allow_pause,
    allow_renewal: s.plan?.allow_renewal,
    allow_early_close: s.plan?.allow_early_close,
    plan_id: String(s.plan_id),
    plan_name: s.plan?.name,
    billing_cycle: s.plan?.billing_cycle,
    subtotal,
    tax_amount: s.total_amount - subtotal,
    discount_amount: 0,
    lines: s.lines.map((l: any) => ({
      ...l,
      id: String(l.id),
      product_id: String(l.product_id),
      variant_id: l.variant_id ? String(l.variant_id) : undefined,
      product_name: l.product?.name,
      variant_name: l.variant?.name,
    })),
  };
};
export const mapPayment = (p: any): PaymentRecord => ({
  ...p,
  id: String(p.id),
  invoice_id: String(p.invoice_id),
  customer_id: String(p.customer_id || ''),
  reference_number: p.reference_note || p.payment_number,
  notes: p.reference_note,
});
export const mapInvoice = (i: any): Invoice => ({
  ...i,
  id: String(i.id),
  customer_id: String(i.customer_id),
  customer_name: i.customer?.full_name,
  customer_email: i.customer?.email,
  customer_address: i.customer?.company_name,
  subscription_id: i.subscription_id ? String(i.subscription_id) : undefined,
  total_amount: i.total,
  amount_paid: i.amount_paid,
  balance_due: i.amount_due,
  status:
    i.status === 'confirmed' && new Date(i.due_date).getTime() < Date.now() ? 'overdue' : i.status,
  lines: i.lines.map((l: any) => ({
    ...l,
    description: [l.product?.name, l.variant?.name].filter(Boolean).join(' · '),
    product_name: l.product?.name,
    tax_amount: l.total - l.subtotal,
    amount: l.subtotal,
  })),
  payments: (i.payments || []).map(mapPayment),
});
export const mapDiscount = (d: any): Discount => ({
  ...d,
  id: String(d.id),
  code: d.code || '',
  min_purchase: d.min_purchase_amount,
  used_count: d.current_uses,
  status: !d.is_active
    ? 'disabled'
    : d.end_date && new Date(d.end_date).getTime() < Date.now()
      ? 'expired'
      : 'active',
});
