from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.plan import Plan, BillingCycle
from app.models.product import Product
from app.models.user import User
from app.schemas.plan import PlanCreate, PlanUpdate, PlanResponse
from app.dependencies import (
    get_current_active_user,
    require_admin,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/plans", tags=["Subscription Plans"])


@router.get("/", response_model=List[PlanResponse])
def list_plans(
    product_id: Optional[int] = None,
    billing_cycle: Optional[BillingCycle] = None,
    is_active: Optional[bool] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List plans with product, billing cycle, active status filters and pagination."""
    query = db.query(Plan)
    if product_id:
        query = query.filter(Plan.product_id == product_id)
    if billing_cycle:
        query = query.filter(Plan.billing_cycle == billing_cycle)
    if is_active is not None:
        query = query.filter(Plan.is_active == is_active)

    return query.order_by(Plan.id.asc()).offset(pagination.skip).limit(pagination.limit).all()


@router.post("/", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    plan_in: PlanCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new subscription plan (admin only)."""
    product = db.query(Product).filter(Product.id == plan_in.product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated product not found")

    plan = Plan(
        name=plan_in.name.strip(),
        product_id=plan_in.product_id,
        billing_cycle=plan_in.billing_cycle,
        price=plan_in.price,
        min_quantity=plan_in.min_quantity,
        available_from=plan_in.available_from,
        available_to=plan_in.available_to,
        auto_close=plan_in.auto_close,
        allow_early_close=plan_in.allow_early_close,
        allow_pause=plan_in.allow_pause,
        allow_renewal=plan_in.allow_renewal,
        is_active=plan_in.is_active,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    log_activity(
        db,
        action="plan_created",
        entity_type="plan",
        entity_id=plan.id,
        user_id=admin.id,
        details=f"Admin created plan: {plan.name} (${plan.price}/{plan.billing_cycle.value})"
    )
    return plan


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single plan details."""
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@router.put("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: int,
    plan_update: PlanUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update subscription plan attributes (admin only)."""
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if plan_update.name is not None:
        plan.name = plan_update.name.strip()
    if plan_update.product_id is not None:
        product = db.query(Product).filter(Product.id == plan_update.product_id).first()
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated product not found")
        plan.product_id = plan_update.product_id
    if plan_update.billing_cycle is not None:
        plan.billing_cycle = plan_update.billing_cycle
    if plan_update.price is not None:
        plan.price = plan_update.price
    if plan_update.min_quantity is not None:
        plan.min_quantity = plan_update.min_quantity
    if plan_update.available_from is not None:
        plan.available_from = plan_update.available_from
    if plan_update.available_to is not None:
        plan.available_to = plan_update.available_to
    if plan_update.auto_close is not None:
        plan.auto_close = plan_update.auto_close
    if plan_update.allow_early_close is not None:
        plan.allow_early_close = plan_update.allow_early_close
    if plan_update.allow_pause is not None:
        plan.allow_pause = plan_update.allow_pause
    if plan_update.allow_renewal is not None:
        plan.allow_renewal = plan_update.allow_renewal
    if plan_update.is_active is not None:
        plan.is_active = plan_update.is_active

    db.commit()
    db.refresh(plan)
    log_activity(
        db,
        action="plan_updated",
        entity_type="plan",
        entity_id=plan.id,
        user_id=admin.id,
        details=f"Admin updated plan {plan.name}"
    )
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_200_OK)
def deactivate_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate a plan (admin only)."""
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    plan.is_active = False
    db.commit()
    log_activity(
        db,
        action="plan_deactivated",
        entity_type="plan",
        entity_id=plan.id,
        user_id=admin.id,
        details=f"Admin deactivated plan {plan.name}"
    )
    return {"message": f"Plan '{plan.name}' deactivated."}
