import apiClient from './client';
export interface RecoveryParameters {
  max_accounts: number;
  collection_rate: number;
  min_days_overdue: number;
}
export interface CollectionNote {
  status: 'open' | 'contacted' | 'promised' | 'disputed';
  note: string;
  owner_name: string | null;
  promised_amount: number | null;
  promise_date: string | null;
  promise_state: 'on_track' | 'missed' | 'fulfilled' | null;
  remaining_promise: number;
  updated_at: string | null;
}
export interface RecoveryInvoice {
  invoice_id: number;
  invoice_number: string;
  due_date: string;
  balance: number;
  amount_paid: number;
  days_overdue: number;
  eligible: boolean;
  hold_reason: string | null;
  case: CollectionNote;
}
export interface RecoveryAccount {
  customer_id: number;
  customer_name: string;
  company_name: string | null;
  email: string;
  overdue_balance: number;
  eligible_balance: number;
  max_days_overdue: number;
  amount_paid: number;
  broken_promises: number;
  disputed_invoices: number;
  active_promises: number;
  mrr_exposed: number;
  priority_score: number;
  score_breakdown: { age: number; balance: number; missed_promise: number };
  reasons: string[];
  recommended_action: string;
  invoices: RecoveryInvoice[];
}
export interface RecoveryOverview {
  currency: 'INR';
  generated_at: string;
  min_days_overdue: number;
  summary: {
    outstanding_balance: number;
    overdue_balance: number;
    overdue_invoice_count: number;
    overdue_account_count: number;
    eligible_balance: number;
    eligible_account_count: number;
    mrr_exposed: number;
    due_next_seven_days: number;
    promised_next_fourteen_days: number;
    active_promises: number;
    broken_promises: number;
    overdue_share: number;
  };
  aging: { label: string; amount: number }[];
  accounts: RecoveryAccount[];
  methodology: { priority: string; holds: string; simulation: string; mrr: string };
}
export interface RecoveryScenario {
  currency: 'INR';
  generated_at: string;
  parameters: RecoveryParameters;
  baseline_overdue: number;
  targeted_balance: number;
  modeled_collection: number;
  remaining_overdue: number;
  target_count: number;
  invoice_count: number;
  disclaimer: string;
  targets: {
    customer_id: number;
    customer_name: string;
    company_name: string | null;
    priority_score: number;
    eligible_balance: number;
    modeled_collection: number;
    invoice_ids: number[];
    reasons: string[];
    recommended_action: string;
  }[];
}
export interface SavedRecoveryPlan {
  id: number;
  title: string;
  created_at: string;
  created_by: string;
  snapshot: RecoveryScenario;
}
export interface CollectionUpdate {
  status: CollectionNote['status'];
  note: string;
  promised_amount?: number;
  promise_date?: string;
}
export const recoveryApi = {
  overview: async (min_days_overdue = 1, signal?: AbortSignal): Promise<RecoveryOverview> =>
    (await apiClient.get('/recovery/overview', { params: { min_days_overdue }, signal })).data,
  simulate: async (
    parameters: RecoveryParameters,
    signal?: AbortSignal,
  ): Promise<RecoveryScenario> =>
    (await apiClient.post('/recovery/simulate', parameters, { signal })).data,
  savePlan: async (parameters: RecoveryParameters, title: string): Promise<SavedRecoveryPlan> =>
    (await apiClient.post('/recovery/plans', { ...parameters, title })).data,
  plans: async (): Promise<SavedRecoveryPlan[]> => (await apiClient.get('/recovery/plans')).data,
  updateCase: async (invoiceId: number, data: CollectionUpdate) =>
    (await apiClient.put(`/recovery/cases/${invoiceId}`, data)).data,
  draft: async (invoiceId: number): Promise<{ subject: string; body: string; delivery: string }> =>
    (await apiClient.get(`/recovery/drafts/${invoiceId}`)).data,
};
