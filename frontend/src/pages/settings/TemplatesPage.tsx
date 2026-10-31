import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, ArrowRight } from 'lucide-react';
import apiClient from '../../api/client';
import { plansApi } from '../../api/plans';
import { dashboardApi } from '../../api/dashboard';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import { showToast } from '../../components/ui/Toast';
interface Template {
  id: number;
  name: string;
  plan_id: number;
  validity_days: number;
  default_lines: string;
  quoted_subtotal: number | null;
  is_available: boolean;
  unavailable_reason?: string;
  line_count: number;
  plan: { name: string; price: number; billing_cycle: string };
}
export function TemplatesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('');
  const [days, setDays] = useState(30);
  const [customer, setCustomer] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<Template[]> =>
      (await apiClient.get('/subscriptions/templates')).data,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.getPlans(),
  });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: dashboardApi.getUsers });
  const create = useMutation({
    mutationFn: async () => {
      const p = plans.find((p) => p.id === plan)!;
      return apiClient.post('/subscriptions/templates', {
        name,
        plan_id: Number(plan),
        validity_days: days,
        default_lines: JSON.stringify([
          { product_id: Number(p.product_id), quantity: p.min_qty, unit_price: p.price },
        ]),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      showToast.success('Quotation template saved.');
    },
  });
  const apply = useMutation({
    mutationFn: async () =>
      apiClient.post(`/subscriptions/templates/${selected!.id}/apply`, {
        customer_id: Number(customer),
        payment_terms: terms,
      }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries();
      navigate(`/subscriptions/${data.id}`);
      showToast.success('Quotation created from the template.');
    },
  });
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="page-heading">A head start on every offer.</h1>
          <p className="subtle mt-2">
            Reusable quotations with a plan, product lines, and a validity window.
          </p>
        </div>
        <Button leftIcon={<Plus size={13} />} onClick={() => setOpen(true)}>
          New template
        </Button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {templates.map((t) => (
          <article key={t.id} className="panel p-6 flex flex-col">
            <BookOpen size={22} strokeWidth={1.3} className="text-[#8b9c75]" />
            <h2 className="font-medium text-base mt-5">{t.name}</h2>
            <p className="subtle mt-2">{t.plan?.name}</p>
            <p className="text-xl tracking-tight mt-4">
              {t.quoted_subtotal === null ? 'Unavailable' : formatCurrency(t.quoted_subtotal)}
              <span className="text-[10px] text-slate-400 ml-1">/ {t.plan?.billing_cycle}</span>
            </p>
            <p className="subtle mt-2 text-[10px]">
              Valid for {t.validity_days} days · {t.line_count} product line(s) · before tax
            </p>
            {t.unavailable_reason && (
              <p className="text-xs text-amber-700 mt-3">{t.unavailable_reason}</p>
            )}
            <div className="pt-5 mt-auto">
              <Button
                variant="outline"
                disabled={!t.is_available}
                title={t.unavailable_reason}
                className="w-full"
                rightIcon={<ArrowRight size={12} />}
                onClick={() => {
                  setCustomer(users.find((u) => u.role === 'customer')?.id || '');
                  setSelected(t);
                }}
              >
                Use this template
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!templates.length && (
        <p className="panel p-10 subtle">
          Create your first template to prepare quotations faster.
        </p>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create a quotation template">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input
            label="Template name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            label="Plan"
            required
            options={[
              { value: '', label: 'Select a plan' },
              ...plans
                .filter((p) => p.status === 'active')
                .map((p) => ({ value: p.id, label: p.name })),
            ]}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          />
          <Input
            label="Quotation validity (days)"
            type="number"
            required
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
          <p className="subtle text-[11px]">
            The template snapshots the plan's core product, minimum quantity, and unit price. You
            can add more templates as your offers evolve.
          </p>
          <Button type="submit" isLoading={create.isPending}>
            Save template
          </Button>
        </form>
      </Modal>
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Prepare a customer quotation"
        description={selected?.name}
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            apply.mutate();
          }}
        >
          <Select
            label="Customer"
            required
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            options={users
              .filter((u) => u.role === 'customer')
              .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
          />
          <Select
            label="Payment terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            options={['Immediate', 'Net 15', 'Net 30', 'Net 60'].map((t) => ({
              value: t,
              label: t,
            }))}
          />
          <Button type="submit" isLoading={apply.isPending}>
            Create quotation
          </Button>
        </form>
      </Modal>
    </div>
  );
}
