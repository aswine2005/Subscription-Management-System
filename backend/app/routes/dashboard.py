from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services.analytics_service import get_dashboard_summary
from app.dependencies import require_staff_or_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Analytics"])


@router.get("/summary", response_model=DashboardSummary)
def get_executive_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """
    Get comprehensive executive metrics and analytics for BrightLoop:
    - Active subscriptions
    - Total collected revenue
    - Outstanding & overdue amounts
    - Monthly Recurring Revenue (MRR)
    - Annual Recurring Revenue (ARR)
    - Churn rate
    - 12-month revenue history
    - Status & plan distributions
    - Top customers by spend
    - Recent system and billing activities
    """
    return get_dashboard_summary(db)
