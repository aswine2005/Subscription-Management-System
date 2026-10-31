from datetime import datetime
from collections import defaultdict
from sqlalchemy.orm import Session, selectinload
from app.models.subscription import Subscription, SubscriptionStatus, SubscriptionLine
from app.models.plan import Plan, BillingCycle
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole
from app.models.discount import ActivityLog
from app.schemas.dashboard import DashboardSummary, OverdueInfo, MonthlyRevenue, PlanSubscriptionCount, TopCustomer
from app.schemas.discount import ActivityLogResponse

def get_dashboard_summary(db: Session) -> DashboardSummary:
    now = datetime.utcnow()
    subs = db.query(Subscription).options(selectinload(Subscription.lines), selectinload(Subscription.plan)).all()
    invoices = db.query(Invoice).options(selectinload(Invoice.payments)).all()
    payments = db.query(Payment).filter(Payment.status == PaymentStatus.completed).all()
    customers = db.query(User).filter(User.role == UserRole.customer).all()
    plans = db.query(Plan).all()
    statuses = defaultdict(int)
    by_plan, by_customer = defaultdict(int), defaultdict(int)
    mrr = 0
    factors = {BillingCycle.daily: 365.25 / 12, BillingCycle.weekly: 52 / 12, BillingCycle.monthly: 1, BillingCycle.yearly: 1 / 12}
    for sub in subs:
        statuses[sub.status.value] += 1
        by_plan[sub.plan_id] += 1
        if sub.status == SubscriptionStatus.active:
            mrr += sum(l.subtotal for l in sub.lines) * factors[sub.plan.billing_cycle]
            by_customer[sub.customer_id] += 1
    outstanding, overdue_amount, overdue_count = 0, 0, 0
    invoice_customers = {i.id: i.customer_id for i in invoices}
    for inv in invoices:
        if inv.status not in (InvoiceStatus.confirmed, InvoiceStatus.overdue):
            continue
        balance = max(0, inv.total - sum(p.amount for p in inv.payments if p.status == PaymentStatus.completed))
        outstanding += balance
        if balance > 0 and inv.due_date < now:
            overdue_amount += balance
            overdue_count += 1
    customer_revenue, monthly = defaultdict(float), defaultdict(float)
    for payment in payments:
        customer_revenue[invoice_customers[payment.invoice_id]] += payment.amount
        monthly[payment.payment_date.strftime("%Y-%m")] += payment.amount
    months = [] 
    for i in range(11, -1, -1):
        year, month = divmod(now.year * 12 + now.month - 1 - i, 12)
        label = f"{year:04d}-{month+1:02d}"
        months.append(MonthlyRevenue(month=label, revenue=round(monthly[label], 2)))
    top = [TopCustomer(customer_id=c.id, name=c.full_name, email=c.email, company_name=c.company_name, revenue=round(customer_revenue[c.id],2), active_subscriptions=by_customer[c.id]) for c in customers]
    activities = db.query(ActivityLog).options(selectinload(ActivityLog.user)).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(12).all()
    return DashboardSummary(active_subscriptions=statuses['active'], total_revenue=round(sum(p.amount for p in payments),2),
        outstanding_revenue=round(outstanding,2), mrr=round(mrr,2), arr=round(mrr*12,2),
        overdue_invoices=OverdueInfo(count=overdue_count, total_amount=round(overdue_amount,2)), revenue_by_month=months,
        subscriptions_by_status={s.value: statuses[s.value] for s in SubscriptionStatus},
        subscriptions_by_plan=sorted([PlanSubscriptionCount(plan_id=p.id, plan_name=p.name, count=by_plan[p.id]) for p in plans], key=lambda p: p.count, reverse=True),
        top_customers=sorted(top, key=lambda c: c.revenue, reverse=True)[:6],
        recent_activities=[ActivityLogResponse(id=a.id, user_id=a.user_id, user_name=a.user.full_name if a.user else 'System', action=a.action, entity_type=a.entity_type, entity_id=a.entity_id, details=a.details, created_at=a.created_at) for a in activities])
