export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at?: string;
  avatar?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ProductVariant {
  id?: string;
  name: string;
  additional_price: number;
}

export type ProductType = 'service' | 'goods' | 'digital';

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  sales_price: number;
  cost_price: number;
  status: 'active' | 'archived';
  variants: ProductVariant[];
  description?: string;
  created_at?: string;
}

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly';

export interface Plan {
  id: string;
  name: string;
  product_id: string;
  product_name?: string;
  billing_cycle: BillingCycle;
  price: number;
  min_qty: number;
  auto_close: boolean;
  allow_early_close: boolean;
  allow_pause: boolean;
  allow_renewal: boolean;
  status: 'active' | 'archived';
  description?: string;
  created_at?: string;
}

export type SubscriptionStatus =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'paused'
  | 'closed';

export interface SubscriptionLine {
  id?: string;
  product_id: string;
  product_name?: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
}

export interface Subscription {
  id: string;
  subscription_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  plan_id: string;
  plan_name?: string;
  status: SubscriptionStatus;
  start_date: string;
  expiry_date: string;
  billing_cycle: BillingCycle;
  payment_terms?: string;
  lines: SubscriptionLine[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  quotation_template?: string;
  notes?: string;
  created_at?: string;
}

export type InvoiceStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled' | 'overdue';

export interface InvoiceLine {
  id?: string;
  description: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  tax_amount: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_address?: string;
  subscription_id?: string;
  subscription_number?: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  lines: InvoiceLine[];
  payments?: PaymentRecord[];
  notes?: string;
  created_at?: string;
}

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash' | 'paypal' | 'stripe';

export interface PaymentRecord {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  customer_id: string;
  customer_name?: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number?: string;
  notes?: string;
  status?: 'completed' | 'pending' | 'failed';
  created_at?: string;
}

export type DiscountType = 'percentage' | 'fixed';

export interface Discount {
  id: string;
  name: string;
  code: string;
  type: DiscountType;
  value: number;
  min_purchase: number;
  start_date: string;
  end_date: string;
  max_uses?: number;
  used_count: number;
  status: 'active' | 'expired' | 'disabled';
  created_at?: string;
}

export interface DashboardSummary {
  active_subscriptions: number;
  active_subscriptions_change: number;
  mrr: number;
  mrr_change: number;
  revenue_this_month: number;
  revenue_this_month_change: number;
  overdue_invoices: number;
  overdue_invoices_change: number;
  revenue_chart: {
    month: string;
    revenue: number;
    projected: number;
  }[];
  subscription_status: {
    name: string;
    value: number;
    color: string;
  }[];
  plan_distribution: {
    name: string;
    subscribers: number;
    revenue: number;
  }[];
  top_customers: {
    id: string;
    name: string;
    email: string;
    subscriptions_count: number;
    total_spent: number;
    status: string;
  }[];
  recent_activity: {
    id: string;
    type: 'subscription' | 'invoice' | 'payment' | 'user';
    title: string;
    description: string;
    timestamp: string;
    user?: string;
  }[];
}

export interface CustomerDashboardData {
  active_subscriptions_count: number;
  total_spent: number;
  next_billing_date: string;
  recent_subscriptions: Subscription[];
  recent_invoices: Invoice[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
