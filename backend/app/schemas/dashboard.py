from typing import List, Dict, Optional
from pydantic import Field, BaseModel

from app.schemas.base import ValidatedModel, CurrencyModel

from app.schemas.discount import ActivityLogResponse


class OverdueInfo(ValidatedModel):
    count: int
    total_amount: float


class MonthlyRevenue(ValidatedModel):
    month: str
    revenue: float


class PlanSubscriptionCount(ValidatedModel):
    plan_id: int
    plan_name: str = Field(min_length=2, max_length=255)
    count: int


class TopCustomer(ValidatedModel):
    customer_id: int
    name: str = Field(min_length=2, max_length=255)
    email: str
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    revenue: float
    active_subscriptions: int


class DashboardSummary(CurrencyModel):
    active_subscriptions: int
    total_revenue: float
    outstanding_revenue: float
    mrr: float
    arr: float
    overdue_invoices: OverdueInfo
    revenue_by_month: List[MonthlyRevenue]
    subscriptions_by_status: Dict[str, int]
    subscriptions_by_plan: List[PlanSubscriptionCount]
    top_customers: List[TopCustomer]
    recent_activities: List[ActivityLogResponse]
