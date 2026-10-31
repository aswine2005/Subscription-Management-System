"""API regression tests. Each test uses a fresh, isolated SQLite database."""
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole, Product, ProductType, Plan, BillingCycle, Subscription, SubscriptionLine, SubscriptionStatus, TaxRule, Discount, DiscountType, DiscountAppliesTo, Invoice, Payment
from app.models.billing_claim import BillingClaim
from app.utils.security import get_password_hash, create_access_token
from app.services.calendar import advance


class WorkflowFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password_hash = get_password_hash('Correct@Test123')

    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, autoflush=False)
        def database():
            with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = database
        # Deliberately do not start the production scheduler in an isolated test.
        self.client = TestClient(app)
        self.now = datetime.utcnow().replace(microsecond=0)
        with self.sessions() as db:
            users = [User(email=f'{role.value}@example.com',full_name=role.title()+' User',role=role,hashed_password=self.password_hash,is_active=True) for role in UserRole]
            db.add_all(users)
            db.flush()
            self.ids = {u.role.value:u.id for u in users}
            product = Product(name='Core Software',type=ProductType.software,sales_price=100,cost_price=20,is_active=True)
            extra = Product(name='Support Add-on',type=ProductType.addon,sales_price=50,cost_price=10,is_active=True)
            db.add_all([product,extra]);db.flush()
            self.product_id, self.extra_id = product.id, extra.id
            plan = Plan(name='Monthly Core',product_id=product.id,billing_cycle=BillingCycle.monthly,price=100,min_quantity=1,available_from=self.now-timedelta(days=365),allow_pause=True,allow_renewal=True,allow_early_close=True,is_active=True)
            db.add(plan);db.add(TaxRule(name='Sales Tax',rate=10,is_active=True));db.commit()
            self.plan_id=plan.id
        self.admin=self.headers('admin');self.staff=self.headers('staff');self.customer=self.headers('customer')

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def headers(self,role):
        return {'Authorization':'Bearer '+create_access_token(self.ids[role])}

    def request(self, method, path, *, role='admin', expected=200, **kwargs):
        response = self.client.request(method, '/api/v1'+path, headers=self.headers(role), **kwargs)
        self.assertEqual(response.status_code, expected, response.text)
        return response.json()

    def active_sub(self, **overrides):
        data={'customer_id':self.ids['customer'],'plan_id':self.plan_id,'start_date':(self.now-timedelta(days=1)).isoformat(),'expiry_date':(self.now+timedelta(days=365)).isoformat(),'payment_terms':'Net 30'}
        data.update(overrides)
        sub=self.request('POST','/subscriptions/',json=data,expected=201)
        for status in ['quotation','confirmed','active']:
            self.request('POST',f'/subscriptions/{sub["id"]}/transition',json={'target_status':status})
        return sub['id']

    def invoice(self,sub_id):
        invoice = self.request('POST',f'/subscriptions/{sub_id}/create-invoice',expected=201)
        self.assertEqual(invoice['status'],'draft')
        return self.request('PUT',f'/invoices/{invoice["id"]}',json={'status':'confirmed'})



class WorkflowTests(WorkflowFixture):
    def test_auth_rejects_wrong_password_and_fake_token(self):
        response=self.client.post('/api/v1/auth/login',json={'email':'admin@example.com','password':'wrongpassword'})
        self.assertEqual(response.status_code,401)
        response=self.client.get('/api/v1/auth/me',headers={'Authorization':'Bearer mock_admin_token'})
        self.assertEqual(response.status_code,401)
        data=self.client.post('/api/v1/auth/login',json={'email':'ADMIN@example.com','password':'Correct@Test123'}).json()
        self.assertIn('access_token',data)
        self.assertEqual(data['user']['role'],'admin')

    def test_registration_policy_and_duplicate_email(self):
        for password in ['Short@12','alllowercase!','ALLUPPERCASE!','NoSpecial1234']:
            r=self.client.post('/api/v1/auth/register',json={'full_name':'New Person','email':'new@example.com','password':password})
            self.assertEqual(r.status_code,422,r.text)
        data={'full_name':'New Person','email':'new@example.com','password':'New@Password123'}
        self.assertEqual(self.client.post('/api/v1/auth/register',json=data).status_code,201)
        self.assertEqual(self.client.post('/api/v1/auth/register',json=data).status_code,400)

    def test_role_and_customer_isolation(self):
        self.request('POST','/products/',role='staff',json={'name':'Another','type':'software'},expected=403)
        self.request('POST','/users/staff',role='staff',json={'email':'newstaff@example.com','full_name':'New Staff','password':'Safe@Password123'},expected=403)
        sub=self.active_sub();invoice=self.invoice(sub)
        with self.sessions() as db:
            other=User(email='other@example.com',full_name='Other Customer',role=UserRole.customer,hashed_password=self.password_hash,is_active=True)
            db.add(other);db.commit();other_id=other.id
        headers={'Authorization':'Bearer '+create_access_token(other_id)}
        self.assertEqual(self.client.get(f'/api/v1/invoices/{invoice["id"]}',headers=headers).status_code,403)
        self.assertEqual(self.client.get('/api/v1/subscriptions/',headers=headers).json(),[])
        self.request('POST','/payments/',role='customer',expected=403,json={'invoice_id':invoice['id'],'amount':1,'payment_method':'upi'})

    def test_full_lifecycle_invoice_partial_payment_settlement(self):
        sub=self.active_sub()
        self.request('POST',f'/subscriptions/{sub}/pause')
        self.request('POST',f'/subscriptions/{sub}/resume')
        inv=self.invoice(sub)
        self.assertEqual(inv['total'],110)
        self.assertEqual(inv['amount_due'],110)
        self.request('POST','/payments/',expected=201,json={'invoice_id':inv['id'],'amount':40,'payment_method':'upi','reference_note':'UPI-001','payment_date':self.now.isoformat()})
        partial=self.request('GET',f'/invoices/{inv["id"]}')
        self.assertEqual(partial['amount_due'],70)
        self.assertEqual(partial['status'],'confirmed')
        self.request('POST','/payments/',expected=400,json={'invoice_id':inv['id'],'amount':70.01,'payment_method':'cash'})
        self.request('POST','/payments/',expected=201,json={'invoice_id':inv['id'],'amount':70,'payment_method':'bank_transfer'})
        settled=self.request('GET',f'/invoices/{inv["id"]}')
        self.assertEqual(settled['status'],'paid')
        self.assertEqual(settled['amount_due'],0)
        self.assertEqual(len(settled['payments']),2)
        summary=self.request('GET','/dashboard/summary')
        self.assertEqual(summary['mrr'],100) # Tax is excluded from recurring revenue.
        self.assertEqual(summary['total_revenue'],110)
        self.assertEqual(summary['outstanding_revenue'],0)

    def test_billing_preview_is_read_only_and_run_is_idempotent(self):
        sub=self.active_sub()
        before=self.request('GET','/invoices/billing-preview')
        self.assertEqual(before['ready_count'],1)
        self.assertEqual(before['total'],110)
        with self.sessions() as db:
            self.assertEqual(db.query(Invoice).count(),0)
        first=self.request('POST','/invoices/bulk-generate')
        self.assertEqual(first['generated_count'],1)
        second=self.request('POST','/invoices/bulk-generate')
        self.assertEqual(second['generated_count'],0)
        self.request('POST',f'/subscriptions/{sub}/create-invoice?force=true',expected=409)
        with self.sessions() as db:
            self.assertEqual(db.query(Invoice).count(),1)
            self.assertEqual(db.query(BillingClaim).count(),1)

    def test_product_discount_only_affects_eligible_lines_and_uses(self):
        self.request('POST','/discounts/',expected=201,json={'name':'Core only half price','code':'CORE50','type':'percentage','value':50,'min_quantity':1,'start_date':(self.now-timedelta(days=1)).isoformat(),'max_uses':1,'applies_to':'product','product_id':self.product_id})
        lines=[{'product_id':self.product_id,'quantity':1,'unit_price':100},{'product_id':self.extra_id,'quantity':1,'unit_price':50}]
        first=self.active_sub(lines=lines);self.active_sub(lines=lines)
        preview=self.request('GET','/invoices/billing-preview')
        self.assertEqual(preview['discount_amount'],50) # Usage cap allocated once across the run.
        self.assertEqual(preview['total'],275)
        with self.sessions() as db:
            self.assertEqual(db.query(Discount).first().current_uses,0)
        result=self.request('POST','/invoices/bulk-generate')
        self.assertEqual(result['generated_count'],2)
        self.assertEqual(sum(i['total'] for i in result['invoices']),preview['total'])
        inv=self.request('GET','/invoices/',params={'subscription_id':first})[0]
        self.assertEqual(inv['discount_amount'],50)
        self.assertEqual(inv['tax_amount'],10)
        with self.sessions() as db:
            self.assertEqual(db.query(Discount).first().current_uses,1)

    def test_invalid_financial_rules_are_rejected(self):
        self.request('POST','/discounts/',expected=422,json={'name':'Invalid percentage','type':'percentage','value':101})
        self.request('POST','/discounts/',expected=422,json={'name':'Reversed dates','type':'fixed','value':10,'start_date':self.now.isoformat(),'end_date':(self.now-timedelta(days=1)).isoformat()})
        self.request('POST','/subscriptions/',expected=422,json={'customer_id':self.ids['customer'],'plan_id':self.plan_id,'lines':[{'product_id':self.product_id,'quantity':0,'unit_price':100}]})
        self.request('POST','/products/',expected=422,json={'name':'  ','type':'software','sales_price':-1})

    def test_quota_template_creates_real_quotation(self):
        import json
        template=self.request('POST','/subscriptions/templates',expected=201,json={'name':'Core Team Offer','plan_id':self.plan_id,'validity_days':30,'default_lines':json.dumps([{'product_id':self.product_id,'quantity':3,'unit_price':90}])})
        sub=self.request('POST',f'/subscriptions/templates/{template["id"]}/apply',expected=201,json={'customer_id':self.ids['customer'],'payment_terms':'Net 15'})
        self.assertEqual(sub['status'],'quotation')
        self.assertEqual(sub['total_amount'],270)
        self.assertEqual(sub['lines'][0]['quantity'],3)

    def test_plan_policy_pause_renewal_and_early_close(self):
        self.request('PUT',f'/plans/{self.plan_id}',json={'allow_pause':False,'allow_early_close':False,'allow_renewal':False})
        sub=self.active_sub()
        self.request('POST',f'/subscriptions/{sub}/pause',expected=400)
        self.request('POST',f'/subscriptions/{sub}/close',expected=400)
        self.request('POST',f'/subscriptions/{sub}/renew',expected=400)

    def test_cannot_mark_paid_without_payment_or_cancel_partial_receipt(self):
        inv=self.invoice(self.active_sub())
        self.request('PUT',f'/invoices/{inv["id"]}',expected=400,json={'status':'paid'})
        self.request('POST','/payments/',expected=201,json={'invoice_id':inv['id'],'amount':1,'payment_method':'cash'})
        self.request('PUT',f'/invoices/{inv["id"]}',expected=400,json={'status':'cancelled'})

    def test_calendar_month_and_leap_year(self):
        self.assertEqual(advance(datetime(2028,1,31),BillingCycle.monthly),datetime(2028,2,29))
        self.assertEqual(advance(datetime(2028,2,29),BillingCycle.yearly),datetime(2029,2,28))

    def test_reset_link_single_use_and_expiry(self):
        with patch('app.services.auth_service.send_password_reset_email') as deliver:
            result=self.client.post('/api/v1/auth/forgot-password',json={'email':'customer@example.com'})
            self.assertEqual(result.status_code,200)
            token=deliver.call_args.kwargs['reset_token']
        payload={'token':token,'new_password':'Changed@Password123'}
        self.assertEqual(self.client.post('/api/v1/auth/reset-password',json=payload).status_code,200)
        self.assertEqual(self.client.post('/api/v1/auth/reset-password',json=payload).status_code,400)

    def test_currency_is_explicit_and_amounts_remain_in_rupees(self):
        product=self.request('GET',f'/products/{self.product_id}')
        self.assertEqual(product['currency'],'INR')
        self.assertEqual(product['sales_price'],100)
        plan=self.request('GET',f'/plans/{self.plan_id}')
        self.assertEqual(plan['currency'],'INR')
        sub=self.active_sub()
        self.assertEqual(self.request('GET',f'/subscriptions/{sub}')['currency'],'INR')
        inv=self.invoice(sub)
        self.assertEqual(inv['currency'],'INR')
        self.assertEqual(inv['total'],110)
        self.assertEqual(self.request('GET','/dashboard/summary')['currency'],'INR')
        self.assertEqual(self.request('GET','/invoices/billing-preview')['currency'],'INR')
        self.request('POST','/products/',expected=422,json={'name':'Wrong currency','type':'software','currency':'USD'})
        health=self.client.get('/health').json()
        self.assertEqual(health['currency'],'INR')
        self.assertEqual(health['database'],'connected')

    def test_rupee_receipts_reject_fractional_paise(self):
        inv=self.invoice(self.active_sub())
        for amount in [0.001,0.015]:
            self.request('POST','/payments/',expected=422,json={'invoice_id':inv['id'],'amount':amount,'payment_method':'upi'})
        pay=self.request('POST','/payments/',expected=201,json={'invoice_id':inv['id'],'amount':0.01,'payment_method':'upi'})
        self.assertEqual(pay['currency'],'INR')
        self.assertEqual(self.request('GET',f'/invoices/{inv["id"]}')['amount_due'],109.99)
        error=self.request('POST','/payments/',expected=400,json={'invoice_id':inv['id'],'amount':200,'payment_method':'upi'})
        self.assertIn('₹',error['detail'])
        self.assertNotIn('$',error['detail'])

    def test_email_uses_inr_and_indian_grouping(self):
        from app.utils.money import format_inr
        from app.utils.email import send_invoice_notification
        self.assertEqual(format_inr(123456.78),'₹1,23,456.78')
        with patch('app.utils.email.deliver',return_value=False) as deliver:
            send_invoice_notification('customer@example.com','TEST-INR',123456.78,'2026-11-30')
        self.assertIn('₹1,23,456.78 (INR)',deliver.call_args.args[2])

    def test_template_variants_are_valid_and_surcharge_is_added_once(self):
        import json
        from app.models import ProductVariant
        with self.sessions() as db:
            variant=ProductVariant(product_id=self.product_id,name='Odoo Edition',additional_price=560,is_active=True)
            db.add(variant);db.commit();variant_id=variant.id
        template=self.request('POST','/subscriptions/templates',expected=201,json={'name':'Odoo Offer','plan_id':self.plan_id,'validity_days':30,'default_lines':json.dumps([{'product_id':self.product_id,'variant_id':variant_id,'quantity':2,'unit_price':100}])})
        self.assertEqual(template['quoted_subtotal'],1320)
        sub=self.request('POST',f'/subscriptions/templates/{template["id"]}/apply',expected=201,json={'customer_id':self.ids['customer']})
        self.assertEqual(sub['lines'][0]['unit_price'],660)
        self.assertEqual(sub['total_amount'],1320)
        bad=[{'product_id':self.extra_id,'variant_id':variant_id,'quantity':1,'unit_price':50}]
        self.request('POST','/subscriptions/templates',expected=400,json={'name':'Mismatched variant','plan_id':self.plan_id,'default_lines':json.dumps(bad)})
        self.request('POST','/subscriptions/templates',expected=422,json={'name':'Malformed template','plan_id':self.plan_id,'default_lines':'not JSON'})

    def test_quotation_validity_is_independent_of_yearly_contract_expiry(self):
        import json
        self.request('PUT',f'/plans/{self.plan_id}',json={'billing_cycle':'yearly'})
        template=self.request('POST','/subscriptions/templates',expected=201,json={'name':'Annual Offer','plan_id':self.plan_id,'validity_days':15,'default_lines':json.dumps([{'product_id':self.product_id,'quantity':1,'unit_price':100}])})
        sub=self.request('POST',f'/subscriptions/templates/{template["id"]}/apply',expected=201,json={'customer_id':self.ids['customer']})
        start=datetime.fromisoformat(sub['start_date'].replace('Z','+00:00'))
        expiry=datetime.fromisoformat(sub['expiry_date'].replace('Z','+00:00'))
        valid=datetime.fromisoformat(sub['quotation_valid_until'].replace('Z','+00:00'))
        self.assertGreater((expiry-start).days,360)
        self.assertLessEqual((valid-start).days,15)
        with self.sessions() as db:
            db.get(Subscription,sub['id']).quotation_valid_until=self.now-timedelta(days=1)
            db.commit()
        self.request('POST',f'/subscriptions/{sub["id"]}/transition',expected=400,json={'target_status':'confirmed'})

    def test_archived_template_products_do_not_break_template_listing(self):
        import json
        template=self.request('POST','/subscriptions/templates',expected=201,json={'name':'Available Offer','plan_id':self.plan_id,'default_lines':json.dumps([{'product_id':self.product_id,'quantity':1,'unit_price':100}])})
        self.request('DELETE',f'/products/{self.product_id}')
        templates=self.request('GET','/subscriptions/templates')
        self.assertFalse(templates[0]['is_available'])
        self.request('POST',f'/subscriptions/templates/{template["id"]}/apply',expected=400,json={'customer_id':self.ids['customer']})

    def test_free_contract_preserves_zero_price_and_settles_without_fake_receipt(self):
        sub=self.active_sub(lines=[{'product_id':self.product_id,'quantity':1,'unit_price':0}])
        self.assertEqual(self.request('GET',f'/subscriptions/{sub}')['total_amount'],0)
        invoice=self.request('POST',f'/subscriptions/{sub}/create-invoice',expected=201)
        self.assertEqual(invoice['total'],0)
        confirmed=self.request('PUT',f'/invoices/{invoice["id"]}',json={'status':'confirmed'})
        self.assertEqual(confirmed['status'],'paid')
        self.assertEqual(self.request('GET','/payments/'),[])

    def test_discount_rejects_nonexistent_product(self):
        self.request('POST','/discounts/',expected=400,json={'name':'Missing Product','type':'fixed','value':50,'applies_to':'product','product_id':99999})


if __name__ == '__main__':
    unittest.main()
