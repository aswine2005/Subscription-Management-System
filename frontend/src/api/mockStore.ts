import {
  User,
  Product,
  Plan,
  Subscription,
  Invoice,
  PaymentRecord,
  Discount,
  DashboardSummary,
  CustomerDashboardData,
} from '../types';
import {
  initialUsers,
  initialProducts,
  initialPlans,
  initialSubscriptions,
  initialInvoices,
  initialPayments,
  initialDiscounts,
  initialDashboardSummary,
} from './mockData';

const STORAGE_KEYS = {
  USERS: 'bl_mock_users',
  PRODUCTS: 'bl_mock_products',
  PLANS: 'bl_mock_plans',
  SUBSCRIPTIONS: 'bl_mock_subscriptions',
  INVOICES: 'bl_mock_invoices',
  PAYMENTS: 'bl_mock_payments',
  DISCOUNTS: 'bl_mock_discounts',
  DASHBOARD: 'bl_mock_dashboard',
};

function getStorage<T>(key: string, initial: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) {
      localStorage.setItem(key, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(item);
  } catch {
    return initial;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export const mockStore = {
  getUsers: (): User[] => getStorage(STORAGE_KEYS.USERS, initialUsers),
  saveUsers: (users: User[]) => setStorage(STORAGE_KEYS.USERS, users),

  getProducts: (): Product[] => getStorage(STORAGE_KEYS.PRODUCTS, initialProducts),
  saveProducts: (products: Product[]) => setStorage(STORAGE_KEYS.PRODUCTS, products),

  getPlans: (): Plan[] => getStorage(STORAGE_KEYS.PLANS, initialPlans),
  savePlans: (plans: Plan[]) => setStorage(STORAGE_KEYS.PLANS, plans),

  getSubscriptions: (): Subscription[] => getStorage(STORAGE_KEYS.SUBSCRIPTIONS, initialSubscriptions),
  saveSubscriptions: (subs: Subscription[]) => setStorage(STORAGE_KEYS.SUBSCRIPTIONS, subs),

  getInvoices: (): Invoice[] => getStorage(STORAGE_KEYS.INVOICES, initialInvoices),
  saveInvoices: (invoices: Invoice[]) => setStorage(STORAGE_KEYS.INVOICES, invoices),

  getPayments: (): PaymentRecord[] => getStorage(STORAGE_KEYS.PAYMENTS, initialPayments),
  savePayments: (payments: PaymentRecord[]) => setStorage(STORAGE_KEYS.PAYMENTS, payments),

  getDiscounts: (): Discount[] => getStorage(STORAGE_KEYS.DISCOUNTS, initialDiscounts),
  saveDiscounts: (discounts: Discount[]) => setStorage(STORAGE_KEYS.DISCOUNTS, discounts),

  getDashboardSummary: (): DashboardSummary => getStorage(STORAGE_KEYS.DASHBOARD, initialDashboardSummary),

  getCustomerDashboard: (customerId: string): CustomerDashboardData => {
    const subs = mockStore.getSubscriptions().filter((s) => s.customer_id === customerId);
    const invoices = mockStore.getInvoices().filter((i) => i.customer_id === customerId);
    const totalSpent = invoices
      .filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + i.total_amount, 0);

    const activeSubs = subs.filter((s) => s.status === 'active');
    const nextDate = activeSubs[0]?.expiry_date || '2026-05-01';

    return {
      active_subscriptions_count: activeSubs.length,
      total_spent: totalSpent,
      next_billing_date: nextDate,
      recent_subscriptions: subs.slice(0, 5),
      recent_invoices: invoices.slice(0, 5),
    };
  },
};
