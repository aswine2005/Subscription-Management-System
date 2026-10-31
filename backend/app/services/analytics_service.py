from datetime import datetime, timedelta
from typing import Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.plan import Plan, BillingCycle
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole
from app.models.discount import ActivityLog
from app.schemas.dashboard import (
    DashboardSummary,
    OverdueInfo,
    MonthlyRevenue,
    PlanSubscriptionCount,
    TopCustomer,
)
from app.schemas.discount import ActivityLogResponse


def calculate_mrr(db: Session) -> float:
    """Calculate Monthly Recurring Revenue based on all currently active subscriptions."""
    active_subs = (
        db.query(Subscription)
        .join(Plan)
        .filter(Subscription.status == SubscriptionStatus.active)
        .all()
    )
    
    mrr = 0.0
    for sub in active_subs:
        # Calculate monthly equivalent based on plan price or subscription lines total
        # We compute lines subtotal or plan price
        lines_total = sum(l.total for l in sub.lines) if sub.lines else sub.plan.price
        cycle = sub.plan.billing_cycle
        
        if cycle == BillingCycle.daily:
            monthly_equiv = lines_total * 30.0
        elif cycle == BillingCycle.weekly:
            monthly_equiv = lines_total * 4.333333
        elif cycle == BillingCycle.monthly:
            monthly_equiv = lines_total * 1.0
        elif cycle == BillingCycle.yearly:
            monthly_equiv = lines_total / 12.0
        else:
            monthly_equiv = lines_total

        mrr += monthly_equiv

    return round(mrr, 2)


def get_dashboard_summary(db: Session) -> DashboardSummary:
    now = datetime.utcnow()

    # 1. Active Subscriptions Count
    active_count = db.query(Subscription).filter(Subscription.status == SubscriptionStatus.active).count()
    total_subscriptions = db.query(Subscription).count()
    closed_subscriptions = db.query(Subscription).filter(Subscription.status == SubscriptionStatus.closed).count()

    # 2. Total Revenue (sum of completed payments)
    total_revenue = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
        Payment.status == PaymentStatus.completed
    ).scalar() or 0.0

    # 3. Outstanding Revenue & Overdue Invoices
    # Update status for overdue invoices where due_date < now and status is confirmed
    overdue_candidates = db.query(Invoice).filter(
        Invoice.status == InvoiceStatus.confirmed,
        Invoice.due_date < now
    ).all()
    for inv in overdue_candidates:
        inv.status = InvoiceStatus.overdue
    if overdue_candidates:
        db.commit()

    overdue_invoices_query = db.query(Invoice).filter(Invoice.status == InvoiceStatus.overdue)
    overdue_count = overdue_invoices_query.count()
    overdue_total = db.query(func.coalesce(func.sum(Invoice.total), 0.0)).filter(
        Invoice.status == InvoiceStatus.overdue
    ).scalar() or 0.0

    # Sum of all uncollected amounts for confirmed and overdue invoices
    unpaid_invoices = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.confirmed, InvoiceStatus.overdue])
    ).all()
    
    outstanding_revenue = 0.0
    for inv in unpaid_invoices:
        paid_for_inv = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
            Payment.invoice_id == inv.id,
            Payment.status == PaymentStatus.completed
        ).scalar() or 0.0
        outstanding_revenue += max(0.0, inv.total - paid_for_inv)

    # 4. MRR & ARR
    mrr = calculate_mrr(db)
    arr = round(mrr * 12.0, 2)

    # 5. Churn Rate
    churn_rate = round((closed_subscriptions / total_subscriptions * 100.0), 2) if total_subscriptions > 0 else 0.0

    # 6. Revenue by Month (last 12 months)
    # Generate array of last 12 months YYYY-MM
    revenue_by_month: List[MonthlyRevenue] = []
    # Build a calendar of 12 months
    current_year = now.year
    current_month = now.month
    months = []
    for i in range(11, -1, -1):
        # Go back i months
        month_index = current_month - i
        year = current_year
        while month_index <= 0:
            month_index += 12
            year -= 1
        months.append((year, month_index, f"{year:04d}-{month_index:02d}"))

    for yr, mn, month_str in months:
        # Start and end of month
        start_m = datetime(yr, mn, 1)
        if mn == 12:
            end_m = datetime(yr + 1, 1, 1)
        else:
            end_m = datetime(yr, mn + 1, 1)

        m_rev = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
            Payment.status == PaymentStatus.completed,
            Payment.payment_date >= start_m,
            Payment.payment_date < end_m
        ).scalar() or 0.0
        revenue_by_month.append(MonthlyRevenue(month=month_str, revenue=round(m_rev, 2)))

    # 7. Subscriptions by Status
    status_counts: Dict[str, int] = {}
    for st in SubscriptionStatus:
        cnt = db.query(Subscription).filter(Subscription.status == st).count()
        status_counts[st.value] = cnt

    # 8. Subscriptions by Plan
    plans = db.query(Plan).all()
    subscriptions_by_plan: List[PlanSubscriptionCount] = []
    for p in plans:
        cnt = db.query(Subscription).filter(Subscription.plan_id == p.id).count()
        subscriptions_by_plan.append(PlanSubscriptionCount(
            plan_id=p.id,
            plan_name=p.name,
            count=cnt
        ))
    subscriptions_by_plan.sort(key=lambda x: x.count, reverse=True)

    # 9. Top Customers by Revenue
    customers = db.query(User).filter(User.role == UserRole.customer).all()
    top_customers_list: List[TopCustomer] = []
    for cust in customers:
        # Calculate customer revenue from paid payments through invoices
        cust_rev = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).join(Invoice).filter(
            Invoice.customer_id == cust.id,
            Payment.status == PaymentStatus.completed
        ).scalar() or 0.0

        active_subs_count = db.query(Subscription).filter(
            Subscription.customer_id == cust.id,
            Subscription.status == SubscriptionStatus.active
        ).count()

        top_customers_list.append(TopCustomer(
            customer_id=cust.id,
            name=cust.full_name,
            email=cust.email,
            company_name=cust.company_name,
            revenue=round(cust_rev, 2),
            active_subscriptions=active_subs_count
        ))
    top_customers_list.sort(key=lambda x: x.revenue, reverse=True)
    top_customers = top_customers_list[:10]

    # 10. Recent Activities (last 20 actions)
    activities = (
        db.query(ActivityLog)
        .order_by(desc(ActivityLog.created_at))
        .limit(20)
        .all()
    )
    recent_activities: List[ActivityLogResponse] = []
    for act in activities:
        user_name = act.user.full_name if act.user else "System"
        recent_activities.append(ActivityLogResponse(
            id=act.id,
            user_id=act.user_id,
            user_name=user_name,
            action=act.action,
            entity_type=act.entity_type,
            entity_id=act.entity_id,
            details=act.details,
            created_at=act.created_at
        ))

    return DashboardSummary(
        active_subscriptions=active_count,
        total_revenue=round(total_revenue, 2),
        outstanding_revenue=round(outstanding_revenue, 2),
        mrr=mrr,
        arr=arr,
        churn_rate=churn_rate,
        overdue_invoices=OverdueInfo(
            count=overdue_count,
            total_amount=round(overdue_total, 2)
        ),
        revenue_by_month=revenue_by_month,
        subscriptions_by_status=status_counts,
        subscriptions_by_plan=subscriptions_by_plan,
        top_customers=top_customers,
        recent_activities=recent_activities
    )
