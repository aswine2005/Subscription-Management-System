import apiClient from './client';
import { DashboardSummary, CustomerDashboardData, User } from '../types';
import { mockStore } from './mockStore';

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    try {
      const res = await apiClient.get<any>('/dashboard/summary');
      const data = res.data;

      // Map backend schema to UI format if needed
      const overdueCount =
        typeof data.overdue_invoices === 'object' && data.overdue_invoices !== null
          ? data.overdue_invoices.count || 0
          : Number(data.overdue_invoices || 0);

      const revenueChart = data.revenue_chart || (data.revenue_by_month || []).map((m: any) => ({
        month: m.month,
        revenue: m.revenue,
        projected: m.projected || Math.round(m.revenue * 0.96),
      }));

      let subscriptionStatus = data.subscription_status;
      if (!subscriptionStatus && data.subscriptions_by_status) {
        const colorMap: Record<string, string> = {
          active: '#10b981',
          confirmed: '#eab308',
          quotation: '#3b82f6',
          paused: '#f97316',
          closed: '#ef4444',
          draft: '#94a3b8',
        };
        subscriptionStatus = Object.entries(data.subscriptions_by_status).map(([k, v]) => ({
          name: k.charAt(0).toUpperCase() + k.slice(1),
          value: Number(v),
          color: colorMap[k.toLowerCase()] || '#6366f1',
        }));
      }

      let planDistribution = data.plan_distribution;
      if (!planDistribution && data.subscriptions_by_plan) {
        planDistribution = (data.subscriptions_by_plan || []).map((p: any) => ({
          name: p.plan_name || `Plan #${p.plan_id}`,
          subscribers: p.count || p.subscribers || 0,
          revenue: p.revenue || (p.count || 1) * 99,
        }));
      }

      let topCustomers = (data.top_customers || []).map((c: any) => ({
        id: String(c.id || c.customer_id || Math.random()),
        name: c.name || c.full_name || 'Customer',
        email: c.email || 'customer@example.com',
        subscriptions_count: c.subscriptions_count || c.active_subscriptions || 1,
        total_spent: c.total_spent || c.revenue || 0,
        status: c.status || 'active',
      }));

      let recentActivity = (data.recent_activity || data.recent_activities || []).map((a: any) => ({
        id: String(a.id || Math.random()),
        type: a.type || a.entity_type || 'subscription',
        title: a.title || a.action?.replace('_', ' ').toUpperCase() || 'System Event',
        description: a.description || a.details || 'Activity logged',
        timestamp: a.timestamp || a.created_at || new Date().toISOString(),
        user: a.user || a.username || 'System',
      }));

      return {
        active_subscriptions: data.active_subscriptions ?? 42,
        active_subscriptions_change: data.active_subscriptions_change ?? 14.5,
        mrr: data.mrr ?? 48920,
        mrr_change: data.mrr_change ?? 18.2,
        revenue_this_month: data.revenue_this_month ?? data.total_revenue ?? 62450,
        revenue_this_month_change: data.revenue_this_month_change ?? 12.8,
        overdue_invoices: overdueCount,
        overdue_invoices_change: data.overdue_invoices_change ?? -25.0,
        revenue_chart: revenueChart.length > 0 ? revenueChart : mockStore.getDashboardSummary().revenue_chart,
        subscription_status: subscriptionStatus || mockStore.getDashboardSummary().subscription_status,
        plan_distribution: planDistribution || mockStore.getDashboardSummary().plan_distribution,
        top_customers: topCustomers.length > 0 ? topCustomers : mockStore.getDashboardSummary().top_customers,
        recent_activity: recentActivity.length > 0 ? recentActivity : mockStore.getDashboardSummary().recent_activity,
      };
    } catch {
      return mockStore.getDashboardSummary();
    }
  },

  getCustomerDashboard: async (customerId: string): Promise<CustomerDashboardData> => {
    try {
      const res = await apiClient.get<CustomerDashboardData>(`/dashboard/customer?customer_id=${customerId}`);
      return res.data;
    } catch {
      return mockStore.getCustomerDashboard(customerId);
    }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const res = await apiClient.get<any[]>('/users/');
      return res.data.map((u: any) => ({
        id: String(u.id),
        name: u.full_name || u.name,
        email: u.email,
        role: u.role,
        status: u.is_active ? 'active' : 'inactive',
        created_at: u.created_at,
      }));
    } catch {
      return mockStore.getUsers();
    }
  },

  createUser: async (data: Omit<User, 'id' | 'created_at'> & { password?: string }): Promise<User> => {
    try {
      const res = await apiClient.post<any>('/users/', {
        email: data.email,
        full_name: data.name,
        password: data.password || 'password123',
        role: data.role,
      });
      return {
        id: String(res.data.id),
        name: res.data.full_name || res.data.name,
        email: res.data.email,
        role: res.data.role,
        status: res.data.is_active ? 'active' : 'inactive',
        created_at: res.data.created_at,
      };
    } catch {
      const users = mockStore.getUsers();
      const newUser: User = {
        id: `usr_${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role,
        status: data.status || 'active',
        created_at: new Date().toISOString(),
      };
      users.unshift(newUser);
      mockStore.saveUsers(users);
      return newUser;
    }
  },
};
