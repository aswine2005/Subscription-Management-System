"""Prepare a real, due-now contract for the billing rehearsal. Never deletes data."""
import argparse
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import User, UserRole, Plan, BillingCycle, Subscription, SubscriptionStatus, ProductVariant
from app.schemas.subscription import SubscriptionCreate, SubscriptionLineCreate
from app.services.subscription_service import create_subscription, transition_subscription_status
from run import init_db

MARKER = '[Brightloop judge demo]'


def prepare(new_run=False):
    init_db()
    with SessionLocal() as db:
        existing = db.query(Subscription).filter(Subscription.notes.like(f'{MARKER}%')).order_by(Subscription.id.desc()).first()
        if existing and not new_run:
            print(f'Demo contract already prepared: {existing.subscription_number} ({existing.status.value})')
            print('Use --new-run to prepare another billing period demonstration without deleting prior records.')
            return
        now = datetime.utcnow()
        admin = db.query(User).filter(User.role == UserRole.admin, User.is_active.is_(True)).first()
        customer = db.query(User).filter(User.email == 'liam.vance@apexglobalsaas.com').first()
        plan = db.query(Plan).filter(Plan.is_active.is_(True), Plan.billing_cycle == BillingCycle.monthly, Plan.available_from <= now).first()
        if not admin or not customer or not plan:
            raise SystemExit('The demo needs the initial seed accounts and an active monthly plan.')
        variant = db.query(ProductVariant).filter(ProductVariant.product_id == plan.product_id, ProductVariant.is_active.is_(True), ProductVariant.name.ilike('%odoo%')).first()
        sub = create_subscription(db, SubscriptionCreate(customer_id=customer.id, plan_id=plan.id, start_date=now,
            expiry_date=now+timedelta(days=365), payment_terms='Net 30', notes=MARKER+' Ready for a real billing rehearsal.',
            lines=[SubscriptionLineCreate(product_id=plan.product_id, variant_id=variant.id if variant else None, quantity=max(plan.min_quantity,3), unit_price=plan.price)]), admin)
        for state in [SubscriptionStatus.quotation, SubscriptionStatus.confirmed, SubscriptionStatus.active]:
            sub = transition_subscription_status(db, sub.id, state)
        print(f'Prepared {sub.subscription_number} for {customer.full_name}: {plan.name}.')
        print('Open http://localhost:3000/billing, review the preview, then run billing.')
        print('A second run must create zero additional invoices for this contract period.')


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--new-run',action='store_true',help='Create a new demonstration contract, preserving previous runs.')
    prepare(parser.parse_args().new_run)
