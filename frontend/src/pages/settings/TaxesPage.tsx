import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings2 } from 'lucide-react';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { showToast } from '../../components/ui/Toast';
interface Tax {
  id: number;
  name: string;
  rate: number;
  description: string;
  is_active: boolean;
}
export function TaxesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const { data: taxes = [], isLoading } = useQuery({
    queryKey: ['taxes'],
    queryFn: async (): Promise<Tax[]> => (await apiClient.get('/discounts/tax-rules')).data,
  });
  const create = useMutation({
    mutationFn: async () =>
      apiClient.post('/discounts/tax-rules', { name, rate: Number(rate), is_active: true }),
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      setName('');
      setRate('');
      showToast.success('Tax rule saved. Future invoices use this rule.');
    },
  });
  const toggle = useMutation({
    mutationFn: async (t: Tax) =>
      apiClient.put(`/discounts/tax-rules/${t.id}`, { is_active: !t.is_active }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const columns: Column<Tax>[] = [
    {
      key: 'name',
      header: 'Tax rule',
      render: (t) => <span className="font-medium">{t.name}</span>,
    },
    { key: 'rate', header: 'Rate', render: (t) => `${t.rate}%` },
    {
      key: 'is_active',
      header: 'Status',
      render: (t) => (
        <span className={t.is_active ? 'text-[#708953]' : 'text-slate-400'}>
          {t.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Manage',
      align: 'right',
      render: (t) => (
        <Button
          size="sm"
          variant="outline"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(t)}
        >
          {t.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="page-heading">Taxes & rules.</h1>
          <p className="subtle mt-2">
            Set the rules once. Let the next invoice take care of itself.
          </p>
        </div>
        <Button leftIcon={<Plus size={13} />} onClick={() => setOpen(true)}>
          New tax rule
        </Button>
      </div>
      <div className="panel p-6 flex items-center gap-5">
        <Settings2 className="text-[#85986d]" size={26} strokeWidth={1.3} />
        <div>
          <p className="eyebrow">Combined active rate</p>
          <p className="text-3xl tracking-tight font-medium mt-2">
            {taxes.filter((t) => t.is_active).reduce((a, t) => a + t.rate, 0)}%
          </p>
          <p className="subtle text-[11px] mt-2">
            Applies automatically to lines without an explicit tax rate. Existing invoices keep
            their original tax snapshot.
          </p>
        </div>
      </div>
      <DataTable columns={columns} data={taxes} isLoading={isLoading} />
      <Modal isOpen={open} onClose={() => setOpen(false)} title="New tax rule">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input
            label="Tax name"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. State sales tax"
          />
          <Input
            label="Percentage rate"
            required
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <Button type="submit" isLoading={create.isPending}>
            Save tax rule
          </Button>
        </form>
      </Modal>
    </div>
  );
}
