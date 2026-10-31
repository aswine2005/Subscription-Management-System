"""Recovery analysis must be ledger-backed, explainable, and side-effect free."""
from datetime import timedelta
from unittest.mock import patch
from app.models import Invoice, InvoiceStatus, Payment, User, UserRole
from app.models.recovery import CollectionCase, RecoveryPlan
from tests.test_workflows import WorkflowFixture


class RecoveryTests(WorkflowFixture):
    def overdue_invoice(self, days=30, price=100, customer_id=None):
        sub = self.active_sub(customer_id=customer_id or self.ids['customer'], lines=[{'product_id': self.product_id, 'quantity': 1, 'unit_price': price}])
        invoice = self.invoice(sub)
        with self.sessions() as db:
            db.get(Invoice, invoice['id']).due_date = self.now - timedelta(days=days)
            db.commit()
        return invoice['id']

    def pay(self, invoice_id, value):
        return self.request('POST', '/payments/', expected=201, json={'invoice_id': invoice_id, 'amount': value, 'payment_method': 'upi'})

    def test_partial_receipts_and_mrr_are_counted_once(self):
        invoice = self.overdue_invoice()
        self.overdue_invoice(days=10)
        with self.sessions() as db:
            first = db.get(Invoice, invoice)
            db.add(Invoice(invoice_number='OLDER-PERIOD', subscription_id=first.subscription_id,
                customer_id=first.customer_id, issue_date=self.now-timedelta(days=70),
                due_date=self.now-timedelta(days=40), status=InvoiceStatus.confirmed,
                subtotal=100, tax_amount=10, discount_amount=0, total=110))
            db.commit()
        self.pay(invoice, 40)
        result = self.request('GET', '/recovery/overview')
        self.assertEqual(result['summary']['overdue_balance'], 290)
        self.assertEqual(result['summary']['overdue_invoice_count'], 3)
        self.assertEqual(result['summary']['overdue_account_count'], 1)
        self.assertEqual(result['summary']['mrr_exposed'], 200)
        self.assertEqual(result['accounts'][0]['amount_paid'], 40)
        self.assertEqual(sum(bucket['amount'] for bucket in result['aging']), 290)

    def test_simulation_does_not_record_payments_or_change_invoices(self):
        self.overdue_invoice()
        before = self.request('GET', '/invoices/')
        result = self.request('POST', '/recovery/simulate', json={'max_accounts': 3, 'collection_rate': 50, 'min_days_overdue': 1})
        self.assertEqual(result['modeled_collection'], 55)
        self.assertEqual(result['remaining_overdue'], 55)
        self.assertEqual(result['currency'], 'INR')
        self.assertEqual(self.request('GET', '/invoices/'), before)
        self.assertEqual(self.request('GET', '/payments/'), [])
        with self.sessions() as db:
            self.assertEqual(db.query(CollectionCase).count(), 0)
            self.assertEqual(db.query(RecoveryPlan).count(), 0)
        zero = self.request('POST', '/recovery/simulate', json={'max_accounts': 0, 'collection_rate': 100})
        self.assertEqual(zero['modeled_collection'], 0)
        self.assertEqual(zero['remaining_overdue'], 110)

    def test_followup_budget_is_per_customer_and_priority_has_evidence(self):
        first = self.overdue_invoice(days=90)
        self.overdue_invoice(days=10)
        with self.sessions() as db:
            customer = User(email='second@example.com', full_name='Second Customer', role=UserRole.customer, hashed_password=self.password_hash, is_active=True)
            db.add(customer); db.commit(); customer_id = customer.id
        self.overdue_invoice(days=10, price=200, customer_id=customer_id)
        result = self.request('POST', '/recovery/simulate', json={'max_accounts': 1, 'collection_rate': 50})
        self.assertEqual(result['target_count'], 1)
        self.assertEqual(result['invoice_count'], 2)
        self.assertEqual(result['targeted_balance'], 220)
        self.assertEqual(result['targets'][0]['customer_id'], self.ids['customer'])
        overview = self.request('GET', '/recovery/overview')
        account = overview['accounts'][0]
        self.assertEqual(account['priority_score'], sum(account['score_breakdown'].values()))
        self.assertTrue(any('90 days' in reason for reason in account['reasons']))

    def test_disputes_and_recent_contacts_are_excluded_from_new_targets(self):
        invoice = self.overdue_invoice()
        self.request('PUT', f'/recovery/cases/{invoice}', json={'status': 'disputed', 'note': 'The customer needs a product-line review.'})
        result = self.request('POST', '/recovery/simulate', json={'max_accounts': 3, 'collection_rate': 100})
        self.assertEqual(result['target_count'], 0)
        overview = self.request('GET', '/recovery/overview')
        self.assertEqual(overview['accounts'][0]['invoices'][0]['hold_reason'], 'Resolve dispute first')
        self.request('PUT', f'/recovery/cases/{invoice}', json={'status': 'contacted', 'note': 'Customer contacted; waiting for a reply.'})
        self.assertEqual(self.request('GET', '/recovery/overview')['summary']['eligible_balance'], 0)
        with self.sessions() as db:
            case = db.query(CollectionCase).first()
            case.last_contact_at = self.now - timedelta(days=3)
            db.commit()
        self.assertEqual(self.request('GET', '/recovery/overview')['summary']['eligible_balance'], 110)

    def test_promise_is_reconciled_with_actual_receipts(self):
        invoice = self.overdue_invoice()
        self.request('PUT', f'/recovery/cases/{invoice}', json={'status': 'promised', 'note': 'A partial payment was agreed.', 'promised_amount': 60, 'promise_date': (self.now + timedelta(days=7)).date().isoformat()})
        initial = self.request('GET', '/recovery/overview')
        self.assertEqual(initial['summary']['promised_next_fourteen_days'], 60)
        self.assertEqual(initial['summary']['eligible_balance'], 0)
        self.pay(invoice, 40)
        after = self.request('GET', '/recovery/overview')
        self.assertEqual(after['summary']['promised_next_fourteen_days'], 20)
        self.assertEqual(after['accounts'][0]['invoices'][0]['case']['remaining_promise'], 20)
        self.pay(invoice, 20)
        fulfilled = self.request('GET', '/recovery/overview')
        self.assertEqual(fulfilled['accounts'][0]['invoices'][0]['case']['promise_state'], 'fulfilled')
        self.assertEqual(fulfilled['summary']['eligible_balance'], 50)
        self.pay(invoice, 50)
        self.assertEqual(self.request('GET', '/recovery/overview')['accounts'], [])

    def test_missed_promises_raise_priority_with_visible_reason(self):
        invoice = self.overdue_invoice(days=30)
        before = self.request('GET', '/recovery/overview')['accounts'][0]['priority_score']
        with self.sessions() as db:
            db.add(CollectionCase(invoice_id=invoice, owner_id=self.ids['staff'], status='promised', promised_amount=60, promise_date=(self.now-timedelta(days=1)).date(), promise_recorded_at=self.now-timedelta(days=3)))
            db.commit()
        account = self.request('GET', '/recovery/overview')['accounts'][0]
        self.assertEqual(account['priority_score'], before + 10)
        self.assertEqual(account['broken_promises'], 1)
        self.assertEqual(account['score_breakdown']['missed_promise'], 10)

    def test_saved_plan_is_a_persistent_historical_snapshot(self):
        invoice = self.overdue_invoice()
        result = self.request('POST', '/recovery/plans', expected=201, json={'title': 'Monday collection plan', 'max_accounts': 2, 'collection_rate': 50})
        self.assertEqual(result['snapshot']['modeled_collection'], 55)
        self.pay(invoice, 10)
        history = self.request('GET', '/recovery/plans')
        self.assertEqual(history[0]['snapshot']['baseline_overdue'], 110)
        self.assertEqual(self.request('GET', '/recovery/overview')['summary']['overdue_balance'], 100)
        with self.sessions() as db:
            self.assertEqual(db.query(RecoveryPlan).count(), 1)

    def test_customers_cannot_access_recovery_and_staff_can_log_actions(self):
        invoice = self.overdue_invoice()
        for path in ['/recovery/overview', '/recovery/plans', f'/recovery/drafts/{invoice}']:
            self.request('GET', path, role='customer', expected=403)
        self.request('POST', '/recovery/simulate', role='customer', expected=403, json={})
        self.request('PUT', f'/recovery/cases/{invoice}', role='customer', expected=403, json={'status': 'open'})
        self.request('PUT', f'/recovery/cases/{invoice}', role='staff', json={'status': 'open', 'note': 'Reviewing this account.'})
        with self.sessions() as db:
            self.assertEqual(db.query(CollectionCase).first().owner_id, self.ids['staff'])

    def test_invalid_scenarios_and_promises_are_rejected(self):
        invoice = self.overdue_invoice()
        for body in [{'collection_rate': 101}, {'collection_rate': 'NaN'}, {'max_accounts': -1}, {'max_accounts': 51}, {'min_days_overdue': 0}]:
            self.request('POST', '/recovery/simulate', expected=422, json=body)
        self.request('PUT', f'/recovery/cases/{invoice}', expected=422, json={'status': 'promised'})
        self.request('PUT', f'/recovery/cases/{invoice}', expected=422, json={'status': 'disputed', 'note': 'No'})
        self.request('PUT', f'/recovery/cases/{invoice}', expected=400, json={'status': 'promised', 'promised_amount': 111, 'promise_date': self.now.date().isoformat()})
        self.request('PUT', f'/recovery/cases/{invoice}', expected=400, json={'status': 'promised', 'promised_amount': 10, 'promise_date': (self.now-timedelta(days=1)).date().isoformat()})
        self.request('PUT', f'/recovery/cases/{invoice}', expected=422, json={'status': 'promised', 'promised_amount': 0.015, 'promise_date': self.now.date().isoformat()})
        self.pay(invoice, 110)
        self.request('PUT', f'/recovery/cases/{invoice}', expected=400, json={'status': 'open'})
        self.request('POST', '/recovery/plans', expected=400, json={})

    def test_reminder_is_only_a_draft_using_current_balance(self):
        invoice = self.overdue_invoice()
        self.pay(invoice, 40)
        with patch('app.utils.email.deliver') as deliver:
            draft = self.request('GET', f'/recovery/drafts/{invoice}')
        self.assertEqual(draft['delivery'], 'draft_only')
        self.assertIn('₹70.00 (INR)', draft['body'])
        self.assertIn('convenient payment date', draft['body'])
        deliver.assert_not_called()

    def test_age_filter_changes_target_balance_without_hiding_total_debt(self):
        self.overdue_invoice(days=10)
        self.overdue_invoice(days=60)
        overview = self.request('GET', '/recovery/overview?min_days_overdue=30')
        self.assertEqual(overview['summary']['overdue_balance'], 220)
        self.assertEqual(overview['summary']['eligible_balance'], 110)
        scenario = self.request('POST', '/recovery/simulate', json={'max_accounts': 3, 'collection_rate': 50, 'min_days_overdue': 30})
        self.assertEqual(scenario['modeled_collection'], 55)
        self.assertEqual(scenario['remaining_overdue'], 165)
