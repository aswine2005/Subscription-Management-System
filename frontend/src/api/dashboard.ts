import apiClient, { listAll } from './client';
import { DashboardSummary, CustomerDashboardData, User } from '../types';
import { mapUser } from './mappers';
import { subscriptionsApi } from './subscriptions';
import { invoicesApi } from './invoices';
import { paymentsApi } from './payments';
export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const { data: d } = await apiClient.get('/dashboard/summary');
    return {
      ...d,
      active_subscriptions_change: 0,
      mrr_change: 0,
      revenue_this_month: d.revenue_by_month.at(-1)?.revenue || 0,
      revenue_this_month_change: 0,
      overdue_invoices: d.overdue_invoices.count,
      overdue_amount: d.overdue_invoices.total_amount,
      overdue_invoices_change: 0,
      revenue_chart: d.revenue_by_month.map((m: any) => ({ month: m.month, revenue: m.revenue })),
      subscription_status: Object.entries(d.subscriptions_by_status).map(([name, value]) => ({
        name,
        value,
        color: name === 'active' ? '#2f6654' : '#c9c6bc',
      })),
      plan_distribution: d.subscriptions_by_plan.map((p: any) => ({
        name: p.plan_name,
        subscribers: p.count,
        revenue: 0,
      })),
      top_customers: d.top_customers.map((c: any) => ({
        id: String(c.customer_id),
        name: c.name,
        email: c.email,
        subscriptions_count: c.active_subscriptions,
        total_spent: c.revenue,
        status: 'active',
      })),
      recent_activity: d.recent_activities.map((a: any) => ({
        id: String(a.id),
        type: a.entity_type,
        title: a.action.replaceAll('_', ' '),
        description: a.details,
        timestamp: a.created_at,
        user: a.user_name,
      })),
    };
  },
  getCustomerDashboard: async (id: string): Promise<CustomerDashboardData> => {
    const [subs, invoices, payments] = await Promise.all([
      subscriptionsApi.getSubscriptions({ customer_id: id }),
      invoicesApi.getInvoices({ customer_id: id }),
      paymentsApi.getPayments(),
    ]);
    return {
      active_subscriptions_count: subs.filter((s) => s.status === 'active').length,
      total_spent: payments
        .filter((p) => p.payment_date >= `${new Date().getFullYear()}-01-01`)
        .reduce((a, p) => a + p.amount, 0),
      next_billing_date:
        subs
          .filter((s) => s.status === 'active' && s.next_billing_date)
          .map((s) => s.next_billing_date!)
          .sort()[0] || '',
      recent_subscriptions: subs.slice(0, 5),
      recent_invoices: invoices.slice(0, 5),
    };
  },
  getUsers: async (): Promise<User[]> => (await listAll('/users/')).map(mapUser),
  createUser: async (d: Omit<User, 'id' | 'created_at'> & { password?: string }): Promise<User> =>
    mapUser(
      (
        await apiClient.post('/users/staff', {
          email: d.email,
          full_name: d.name,
          password: d.password,
        })
      ).data,
    ),
};
