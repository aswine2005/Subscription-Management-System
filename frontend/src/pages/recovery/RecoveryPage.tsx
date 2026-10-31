import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownRight,
  Target,
  ShieldCheck,
  CircleHelp,
  Clock3,
  Bookmark,
  Check,
  Clipboard,
  ChevronRight,
  SlidersHorizontal,
  MessageSquare,
  CheckCircle2,
  CircleDot,
  Layers,
  Flag,
} from 'lucide-react';
import {
  recoveryApi,
  RecoveryAccount,
  RecoveryInvoice,
  RecoveryScenario,
  CollectionUpdate,
} from '../../api/recovery';
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatRelativeTime,
} from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { showToast } from '../../components/ui/Toast';

const statusLabel = (invoice: RecoveryInvoice) =>
  invoice.case.promise_state === 'missed'
    ? 'Missed promise'
    : invoice.case.promise_state === 'fulfilled'
      ? 'Promise fulfilled'
      : invoice.case.status === 'promised'
        ? 'Payment promised'
        : invoice.case.status === 'disputed'
          ? 'In dispute'
          : invoice.case.status === 'contacted'
            ? 'Contact logged'
            : 'Not followed up';
export function RecoveryPage() {
  const qc = useQueryClient();
  const [capacity, setCapacity] = useState(3);
  const [rate, setRate] = useState(50);
  const [age, setAge] = useState(1);
  const [params, setParams] = useState({
    max_accounts: 3,
    collection_rate: 50,
    min_days_overdue: 1,
  });
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<RecoveryAccount | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [status, setStatus] = useState<CollectionUpdate['status']>('open');
  const [note, setNote] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<RecoveryScenario | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setParams({ max_accounts: capacity, collection_rate: rate, min_days_overdue: age });
      setSavedSnapshot(null);
    }, 250);
    return () => clearTimeout(timer);
  }, [capacity, rate, age]);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['recovery', age],
    queryFn: ({ signal }) => recoveryApi.overview(age, signal),
    refetchInterval: 30000,
  });
  const { data: liveScenario, isFetching: simulating } = useQuery({
    queryKey: ['recovery-scenario', params],
    queryFn: ({ signal }) => recoveryApi.simulate(params, signal),
    refetchInterval: 30000,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['recovery-plans'],
    queryFn: recoveryApi.plans,
  });
  const scenario = liveScenario;
  const parametersPending =
    params.max_accounts !== capacity ||
    params.collection_rate !== rate ||
    params.min_days_overdue !== age;
  const save = useMutation({
    mutationFn: () =>
      recoveryApi.savePlan(
        params,
        `Recovery plan · ${formatDate(new Date().toISOString(), 'dd MMM')}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recovery-plans'] });
      showToast.success('Recovery scenario saved. No payments were recorded.');
    },
  });
  const update = useMutation({
    mutationFn: () =>
      recoveryApi.updateCase(Number(invoiceId), {
        status,
        note,
        ...(status === 'promised'
          ? { promise_date: promiseDate, promised_amount: Number(promiseAmount) }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      setSelected(null);
      showToast.success('Collection action saved to the database.');
    },
  });
  const draftMutation = useMutation({
    mutationFn: (id: number) => recoveryApi.draft(id),
    onSuccess: (d) => {
      setDraft(d);
      setCopied(false);
    },
  });
  const openAccount = (account: RecoveryAccount) => {
    setSelected(account);
    loadInvoice(account.invoices.find((i) => i.eligible) || account.invoices[0]);
    setDraft(null);
  };
  const loadInvoice = (invoice: RecoveryInvoice) => {
    setInvoiceId(String(invoice.invoice_id));
    setStatus(invoice.case.status);
    setNote(invoice.case.note);
    setPromiseDate(invoice.case.promise_date || new Date().toISOString().slice(0, 10));
    setPromiseAmount(
      String(Math.min(invoice.case.promised_amount || invoice.balance, invoice.balance)),
    );
    setDraft(null);
  };
  const selectedInvoice = selected?.invoices.find((i) => String(i.invoice_id) === invoiceId);
  if (isLoading)
    return (
      <div className="py-32">
        <LoadingSpinner text="Tracing the cash in your ledger…" />
      </div>
    );
  if (isError || !data)
    return (
      <div className="panel p-8">
        <h1 className="page-heading">The recovery lab is temporarily unavailable.</h1>
        <p className="subtle my-4">Check the local API connection and try again.</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  const summary = data.summary;
  const filtered = data.accounts.filter(
    (a) =>
      filter === 'all' ||
      (filter === 'followup' && a.eligible_balance > 0) ||
      (filter === 'promised' && a.active_promises > 0) ||
      (filter === 'disputed' && a.disputed_invoices > 0),
  );
  const targetIds = new Set(scenario?.targets.map((t) => t.customer_id) || []);
  const collectedShare =
    scenario && scenario.baseline_overdue
      ? (scenario.modeled_collection / scenario.baseline_overdue) * 100
      : 0;
  return (
    <div className="recovery-workspace">
      <div className="recovery-heading">
        <div>
          <div className="section-kicker">
            <span className="kicker-line" /> FROM RECURRING REVENUE TO REAL CASH
          </div>
          <h1>
            Know what to
            <br />
            <span>collect next.</span>
          </h1>
          <p>Your invoices tell a story. Turn it into a clear next move.</p>
        </div>
        <div className="recovery-heading-right">
          <span className="recovery-live">
            <span className="live-dot" />
            Live from your ledger
          </span>
          <Button
            variant="secondary"
            leftIcon={<CircleHelp size={14} />}
            onClick={() => setMethod(true)}
          >
            How it works
          </Button>
        </div>
      </div>
      <div className="recovery-facts">
        <div className="recovery-fact primary-fact">
          <span>Overdue. Not out of reach.</span>
          <strong>{formatCurrency(summary.overdue_balance)}</strong>
          <small>
            {summary.overdue_invoice_count} invoices across {summary.overdue_account_count}{' '}
            customers
          </small>
        </div>
        <div className="recovery-fact">
          <span>Monthly revenue exposed</span>
          <strong>{formatCurrency(summary.mrr_exposed)}</strong>
          <small>Active contracts held by late-paying customers</small>
        </div>
        <div className="recovery-fact">
          <span>Promises for the next 14 days</span>
          <strong>{formatCurrency(summary.promised_next_fourteen_days)}</strong>
          <small>
            {summary.active_promises} on track · {summary.broken_promises} missed promises
          </small>
        </div>
      </div>
      <div className="recovery-main-grid">
        <section className="recovery-queue panel">
          <div className="recovery-section-head">
            <div>
              <div className="section-kicker">01 / THE OPPORTUNITY</div>
              <h2>Your next conversations.</h2>
              <p>Prioritized by age, balance, and missed commitments.</p>
            </div>
            <span className="count-tag">{data.accounts.length} accounts</span>
          </div>
          <div className="queue-toolbar">
            <div className="recovery-filter-tabs">
              {[
                ['all', 'All accounts'],
                ['followup', 'Needs follow-up'],
                ['promised', 'Promised'],
                ['disputed', 'Disputed'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={filter === value ? 'active' : ''}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="queue-col-head">
            <span>CUSTOMER & NEXT MOVE</span>
            <span>OVERDUE</span>
            <span />
          </div>
          {filtered.length === 0 ? (
            <div className="recovery-empty">
              <CheckCircle2 size={32} strokeWidth={1} />
              <h3>
                {summary.overdue_balance
                  ? 'No accounts in this view.'
                  : 'Nothing overdue. That’s a good place to be.'}
              </h3>
              <p>New invoices and collection updates appear here automatically.</p>
            </div>
          ) : (
            filtered.map((account, index) => (
              <button
                key={account.customer_id}
                className={`recovery-account-row ${targetIds.has(account.customer_id) ? 'is-target' : ''}`}
                onClick={() => openAccount(account)}
              >
                <div className="recovery-account-main">
                  <span className="account-number">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="account-identity">
                      <strong>{account.company_name || account.customer_name}</strong>
                      {targetIds.has(account.customer_id) && (
                        <span className="target-pill">
                          <Target size={9} />
                          In scenario
                        </span>
                      )}
                    </div>
                    <p>
                      {account.customer_name} · {account.invoices.length} invoice
                      {account.invoices.length !== 1 ? 's' : ''}
                    </p>
                    <div className="account-next">
                      <span
                        className={`priority-dot ${account.max_days_overdue > 60 ? 'urgent' : ''}`}
                      />
                      {account.recommended_action}
                    </div>
                  </div>
                </div>
                <div className="recovery-account-amount">
                  <strong>{formatCurrency(account.overdue_balance)}</strong>
                  <span>
                    {account.max_days_overdue === 0
                      ? 'Due earlier today'
                      : `${account.max_days_overdue} days overdue`}
                  </span>
                </div>
                <ChevronRight size={14} />
              </button>
            ))
          )}
          <div className="queue-bottom">
            <ShieldCheck size={14} />
            <span>Every priority has a reason. Open an account to inspect the evidence.</span>
          </div>
        </section>
        <aside className="recovery-simulator">
          <div className="simulator-top">
            <span className="section-kicker">02 / MAKE A PLAN</span>
            <span className="simulation-badge">
              <CircleDot size={9} />
              What-if scenario
            </span>
          </div>
          <h2>
            A small effort.
            <br />A measurable difference.
          </h2>
          <p className="simulator-intro">
            Choose your follow-up capacity and test a collection assumption.
          </p>
          <div className="sim-control">
            <div>
              <label htmlFor="recovery-capacity">Customers you can follow up with</label>
              <strong>{capacity}</strong>
            </div>
            <input
              id="recovery-capacity"
              type="range"
              min={0}
              max={Math.max(12, Math.min(50, summary.eligible_account_count))}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
            <span>{summary.eligible_account_count} accounts currently eligible</span>
          </div>
          <div className="sim-control">
            <div>
              <label htmlFor="recovery-rate">Assumed collection of targeted balances</label>
              <strong>{rate}%</strong>
            </div>
            <input
              id="recovery-rate"
              type="range"
              min={0}
              max={100}
              step={5}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
            <span>An assumption you control, not a prediction.</span>
          </div>
          <div className="sim-age">
            <label htmlFor="recovery-age">Include invoices overdue by</label>
            <select id="recovery-age" value={age} onChange={(e) => setAge(Number(e.target.value))}>
              <option value={1}>At least 1 day</option>
              <option value={30}>At least 30 days</option>
              <option value={60}>At least 60 days</option>
            </select>
          </div>
          <div
            className={`sim-result ${simulating || parametersPending ? 'is-calculating' : ''}`}
            aria-live="polite"
          >
            <div className="flex items-center justify-between">
              <span>Modeled cash recovered</span>
              <ArrowDownRight size={18} />
            </div>
            <strong>
              {scenario ? formatCurrency(scenario.modeled_collection) : 'Calculating…'}
            </strong>
            <p>
              From {scenario?.target_count || 0} customers · {scenario?.invoice_count || 0} eligible
              invoices
            </p>
            <div
              className="scenario-meter"
              role="img"
              aria-label={`${collectedShare.toFixed(1)}% of overdue balances collected in this scenario`}
            >
              <span style={{ width: `${collectedShare}%` }} />
            </div>
            <div className="sim-remaining">
              <span>Still overdue in this scenario</span>
              <b>{scenario ? formatCurrency(scenario.remaining_overdue) : '—'}</b>
            </div>
          </div>
          <Button
            className="w-full sim-save"
            isLoading={save.isPending}
            disabled={!scenario?.target_count || simulating || parametersPending}
            leftIcon={<Bookmark size={14} />}
            onClick={() => save.mutate()}
          >
            Save recovery plan
          </Button>
          <p className="sim-footnote">
            <ShieldCheck size={12} />
            No receipts are recorded and no customer is contacted.
          </p>
        </aside>
      </div>
      <div className="recovery-bottom-grid">
        <section className="panel aging-panel">
          <div className="recovery-section-head">
            <div>
              <div className="section-kicker">03 / KEEP PERSPECTIVE</div>
              <h2>How long has the cash been waiting?</h2>
            </div>
            <Clock3 size={18} />
          </div>
          <div
            className="aging-track"
            role="img"
            aria-label="Distribution of overdue balances by invoice age"
          >
            {data.aging.map((bucket, index) => (
              <span
                key={bucket.label}
                style={{
                  width: `${summary.overdue_balance ? (bucket.amount / summary.overdue_balance) * 100 : 25}%`,
                  background: ['#cbd9c5', '#b9bd93', '#c2946a', '#a85843'][index],
                }}
              />
            ))}
          </div>
          <div className="aging-legend">
            {data.aging.map((bucket, index) => (
              <div key={bucket.label}>
                <span
                  className="aging-color"
                  style={{ background: ['#cbd9c5', '#b9bd93', '#c2946a', '#a85843'][index] }}
                />
                <span>{bucket.label}</span>
                <strong>{formatCurrency(bucket.amount)}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel saved-plans">
          <div className="recovery-section-head">
            <div>
              <div className="section-kicker">YOUR WORK, KEPT IN ORDER</div>
              <h2>Saved recovery plans.</h2>
            </div>
            <Layers size={18} />
          </div>
          {plans.length ? (
            plans.slice(0, 4).map((plan) => (
              <button
                key={plan.id}
                className="saved-plan-row"
                onClick={() => setSavedSnapshot(plan.snapshot)}
              >
                <span className="saved-plan-icon">
                  <Bookmark size={14} />
                </span>
                <span>
                  <strong>{plan.title}</strong>
                  <small>
                    {plan.created_by} · {formatRelativeTime(plan.created_at)}
                  </small>
                </span>
                <b>{formatCompactCurrency(plan.snapshot.modeled_collection)}</b>
                <ArrowUpRight size={13} />
              </button>
            ))
          ) : (
            <p className="saved-empty">
              Save a scenario to bring a concrete, reviewable plan to your next finance meeting.
            </p>
          )}
        </section>
      </div>
      <p className="recovery-source">
        Computed from issued invoices and completed receipts ·{' '}
        {formatDate(data.generated_at, 'dd MMM yyyy, HH:mm')} · INR
      </p>
      <Modal
        isOpen={!!selected}
        onClose={() => {
          setSelected(null);
          setDraft(null);
        }}
        title={selected?.company_name || selected?.customer_name || 'Account details'}
        description="The evidence, the next move, and a place to keep the follow-up."
        size="xl"
      >
        {selected && (
          <div className="collection-detail">
            <div className="case-evidence">
              <span className="case-score">
                {selected.priority_score}
                <small>/100</small>
              </span>
              <div>
                <h4>Why this account is here</h4>
                {selected.reasons.map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
                <span>
                  Priority points: age {selected.score_breakdown.age} + balance{' '}
                  {selected.score_breakdown.balance} + missed promise{' '}
                  {selected.score_breakdown.missed_promise}
                </span>
              </div>
            </div>
            <div className="case-invoices">
              {selected.invoices.map((invoice) => (
                <button
                  key={invoice.invoice_id}
                  onClick={() => loadInvoice(invoice)}
                  className={String(invoice.invoice_id) === invoiceId ? 'active' : ''}
                >
                  <span>
                    <strong>{invoice.invoice_number}</strong>
                    <small>{statusLabel(invoice)}</small>
                  </span>
                  <b>{formatCurrency(invoice.balance)}</b>
                </button>
              ))}
            </div>
            {selectedInvoice && (
              <>
                <div className="case-current">
                  <span>
                    {selectedInvoice.days_overdue} days overdue ·{' '}
                    {selectedInvoice.hold_reason || 'Eligible for follow-up'}
                  </span>
                  <Link to={`/invoices/${invoiceId}`} className="text-link">
                    Open invoice <ArrowUpRight size={12} />
                  </Link>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    update.mutate();
                  }}
                  className="space-y-4"
                >
                  <Select
                    label="Log a collection action"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CollectionUpdate['status'])}
                    options={[
                      { value: 'open', label: 'Open · ready for follow-up' },
                      { value: 'contacted', label: 'I contacted the customer · wait for a reply' },
                      { value: 'promised', label: 'Customer promised a payment' },
                      { value: 'disputed', label: 'Customer disputes this invoice' },
                    ]}
                  />
                  {status === 'promised' && (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Input
                        label="Promised amount (₹)"
                        type="number"
                        step="0.01"
                        min={0.01}
                        max={selectedInvoice.balance}
                        required
                        value={promiseAmount}
                        onChange={(e) => setPromiseAmount(e.target.value)}
                      />
                      <Input
                        label="Promise date"
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        required
                        value={promiseDate}
                        onChange={(e) => setPromiseDate(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="collection-note"
                      className="block text-xs font-medium mb-2 text-slate-600"
                    >
                      Follow-up note
                    </label>
                    <textarea
                      id="collection-note"
                      rows={3}
                      maxLength={1500}
                      minLength={status === 'disputed' ? 5 : 0}
                      required={status === 'disputed'}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What was discussed, what is blocking payment, or what happens next…"
                      className="w-full glass-input rounded-lg p-3 text-sm"
                    />
                  </div>
                  <div className="case-actions">
                    <Button
                      type="submit"
                      isLoading={update.isPending}
                      leftIcon={<Check size={13} />}
                    >
                      Save action
                    </Button>
                    <Button
                      variant="outline"
                      isLoading={draftMutation.isPending}
                      leftIcon={<MessageSquare size={13} />}
                      onClick={() => draftMutation.mutate(Number(invoiceId))}
                    >
                      Prepare reminder draft
                    </Button>
                  </div>
                </form>
                {draft && (
                  <div className="reminder-draft">
                    <div>
                      <strong>{draft.subject}</strong>
                      <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={copied ? <Check size={12} /> : <Clipboard size={12} />}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(draft.body);
                            setCopied(true);
                          } catch {
                            showToast.error('Select and copy the draft text below.');
                          }
                        }}
                      >
                        {copied ? 'Copied' : 'Copy draft'}
                      </Button>
                    </div>
                    <pre>{draft.body}</pre>
                    <p>
                      Draft only. Review it before sending through your own communication channel.
                    </p>
                  </div>
                )}
                {selectedInvoice.case.owner_name && (
                  <p className="case-owner">
                    Last updated by {selectedInvoice.case.owner_name} ·{' '}
                    {formatRelativeTime(selectedInvoice.case.updated_at)}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={!!savedSnapshot}
        onClose={() => setSavedSnapshot(null)}
        title="Saved recovery scenario"
        description={
          savedSnapshot
            ? `Historical snapshot · ${formatDate(savedSnapshot.generated_at, 'dd MMM yyyy, HH:mm')}`
            : ''
        }
        size="lg"
      >
        {savedSnapshot && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500 leading-7">
              A saved scenario for up to{' '}
              <strong>{savedSnapshot.parameters.max_accounts} customers</strong>, assuming
              collection of <strong>{savedSnapshot.parameters.collection_rate}%</strong> of eligible
              balances at least{' '}
              <strong>{savedSnapshot.parameters.min_days_overdue} days overdue</strong>.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="panel p-4">
                <p className="text-xs text-slate-400">Overdue at the time</p>
                <strong className="block text-xl font-medium tracking-tight mt-2">
                  {formatCurrency(savedSnapshot.baseline_overdue)}
                </strong>
              </div>
              <div className="panel p-4">
                <p className="text-xs text-slate-400">Modeled collection</p>
                <strong className="block text-xl font-medium tracking-tight mt-2 text-[#527347]">
                  {formatCurrency(savedSnapshot.modeled_collection)}
                </strong>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {savedSnapshot.targets.map((target) => (
                <div key={target.customer_id} className="py-3 flex gap-3 justify-between text-sm">
                  <span>{target.company_name || target.customer_name}</span>
                  <strong className="font-medium whitespace-nowrap">
                    {formatCurrency(target.modeled_collection)}
                  </strong>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 leading-6">
              This is a historical analytical snapshot. Current balances may have changed. No
              payments were recorded by saving this plan.
            </p>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={method}
        onClose={() => setMethod(false)}
        title="Transparent by design"
        description="No black box and no invented payment probabilities."
      >
        <div className="methodology">
          <h4>
            <Flag size={15} />
            How priorities are calculated
          </h4>
          <p>{data.methodology.priority}</p>
          <h4>
            <Clock3 size={15} />
            When a follow-up is held
          </h4>
          <p>{data.methodology.holds}</p>
          <h4>
            <SlidersHorizontal size={15} />
            What the simulator means
          </h4>
          <p>{data.methodology.simulation}</p>
          <h4>
            <ShieldCheck size={15} />
            What revenue exposure means
          </h4>
          <p>{data.methodology.mrr}</p>
        </div>
      </Modal>
    </div>
  );
}
