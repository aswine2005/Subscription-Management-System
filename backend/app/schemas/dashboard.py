from typing import List, Dict, Optional
from pydantic import BaseModel
from app.schemas.discount import ActivityLogResponse


class OverdueInfo(BaseModel):
    count: int
    total_amount: float


class MonthlyRevenue(BaseModel):
    month: str
    revenue: float


class PlanSubscriptionCount(BaseModel):
    plan_id: int
    plan_name: str
    count: int


class TopCustomer(BaseModel):
    customer_id: int
    name: str
    email: str
    company_name: Optional[str] = None
    revenue: float
    active_subscriptions: int


class DashboardSummary(BaseModel):
    active_subscriptions: int
    total_revenue: float
    outstanding_revenue: float
    mrr: float
    arr: float
    churn_rate: float
    overdue_invoices: OverdueInfo
    revenue_by_month: List[MonthlyRevenue]
    subscriptions_by_status: Dict[str, int]
    subscriptions_by_plan: List[PlanSubscriptionCount]
    top_customers: List[TopCustomer]
    recent_activities: List[ActivityLogResponse]
