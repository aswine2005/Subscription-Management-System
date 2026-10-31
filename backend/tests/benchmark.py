"""Repeatable read-path benchmark against an isolated 1,000-contract SQLite fixture."""
from datetime import timedelta
from time import perf_counter
from tests.test_workflows import WorkflowTests
from app.models import Subscription, SubscriptionLine, SubscriptionStatus, Invoice, InvoiceLine, InvoiceStatus, Payment, PaymentStatus, PaymentMethod

if __name__ == '__main__':
    WorkflowTests.setUpClass()
    case = WorkflowTests()
    case.setUp()
    try:
        with case.sessions() as db:
            for i in range(1000):
                sub = Subscription(subscription_number=f'BENCH-{i:05d}', customer_id=case.ids['customer'], plan_id=case.plan_id, start_date=case.now-timedelta(days=1), expiry_date=case.now+timedelta(days=365), next_billing_date=case.now, payment_terms='Net 30', status=SubscriptionStatus.active, created_by=case.ids['admin'])
                sub.lines.append(SubscriptionLine(product_id=case.product_id,quantity=1,unit_price=100,tax_rate=10,subtotal=100,total=110))
                db.add(sub)
                if i < 500:
                    inv=Invoice(invoice_number=f'BENCH-INV-{i:05d}',subscription=sub,customer_id=case.ids['customer'],issue_date=case.now-timedelta(days=40),due_date=case.now-timedelta(days=10),status=InvoiceStatus.confirmed,subtotal=100,tax_amount=10,discount_amount=0,total=110)
                    inv.lines.append(InvoiceLine(product_id=case.product_id,quantity=1,unit_price=100,tax_rate=10,subtotal=100,total=110))
                    inv.payments.append(Payment(payment_number=f'BENCH-PAY-{i:05d}',amount=40,payment_date=case.now,payment_method=PaymentMethod.upi,status=PaymentStatus.completed))
                    db.add(inv)
            db.commit()
        for path in ['/subscriptions/?limit=100','/invoices/?limit=100','/dashboard/summary','/invoices/billing-preview','/recovery/overview']:
            start=perf_counter()
            data=case.request('GET',path)
            elapsed=(perf_counter()-start)*1000
            print(f'{path}: {elapsed:.1f} ms')
            assert elapsed < 2000, f'{path} exceeded the 2-second target'
        summary=case.request('GET','/dashboard/summary')
        assert summary['active_subscriptions']==1000
        assert summary['mrr']==100000
        assert summary['outstanding_revenue']==35000
        start=perf_counter()
        scenario=case.request('POST','/recovery/simulate',json={'max_accounts':3,'collection_rate':50})
        print(f'/recovery/simulate: {(perf_counter()-start)*1000:.1f} ms')
        assert scenario['modeled_collection']==17500
        print('Verified: 1,000 active contracts, ₹1,00,000 MRR, ₹35,000 outstanding after partial payments.')
    finally:
        case.tearDown()
