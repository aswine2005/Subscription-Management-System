from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models.plan import Plan
from app.models.subscription import SubscriptionLine, Subscription, SubscriptionStatus, QuotationTemplate
from app.models.user import User, UserRole
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionStatusTransition,
    QuotationTemplateCreate,
    QuotationTemplateResponse,
    QuotationTemplateApply,
)
from app.schemas.invoice import InvoiceResponse
from app.services.subscription_service import (
    create_subscription,
    transition_subscription_status,
    pause_subscription,
    resume_subscription,
    close_subscription,
    create_subscription_from_template,
)
from app.services.billing_service import generate_invoice_from_subscription, get_invoice_balance
from app.dependencies import (
    get_current_active_user,
    require_staff_or_admin,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


# --- Quotation Templates Endpoints (placed before dynamic /{id} routes) ---
@router.get("/templates", response_model=List[QuotationTemplateResponse])
def list_quotation_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List available quotation templates."""
    from app.services.subscription_service import decorate_template
    templates = db.query(QuotationTemplate).filter(QuotationTemplate.is_active.is_(True)).all()
    return [decorate_template(db, template) for template in templates]


@router.post("/templates", response_model=QuotationTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    template_in: QuotationTemplateCreate,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """Create a new quotation template (staff and admin only)."""
    from app.models.plan import Plan
    from app.services.subscription_service import validate_template_products, decorate_template
    plan = db.get(Plan, template_in.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=400, detail="Choose an active plan.")
    validate_template_products(db, template_in.default_lines)
    template = QuotationTemplate(
        name=template_in.name.strip(),
        plan_id=template_in.plan_id,
        validity_days=template_in.validity_days,
        default_lines=template_in.default_lines,
        is_active=template_in.is_active,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    log_activity(
        db,
        action="quotation_template_created",
        entity_type="quotation_template",
        entity_id=template.id,
        user_id=staff_user.id,
        details=f"Template created: {template.name}"
    )
    from app.services.subscription_service import decorate_template
    return decorate_template(db, template)


@router.get("/templates/{template_id}", response_model=QuotationTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single quotation template by id."""
    template = db.query(QuotationTemplate).filter(QuotationTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation template not found")
    from app.services.subscription_service import decorate_template
    return decorate_template(db, template)


@router.post("/templates/{template_id}/apply", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def apply_quotation_template(
    template_id: int,
    payload: QuotationTemplateApply,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Apply quotation template to generate a subscription quotation for a customer."""
    cust_id = payload.customer_id
    if current_user.role == UserRole.customer:
        cust_id = current_user.id
    elif not cust_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="customer_id is required")

    sub = create_subscription_from_template(
        db=db,
        template_id=template_id,
        customer_id=cust_id,
        current_user=current_user,
        payment_terms=payload.payment_terms or "Immediate",
        start_date=payload.start_date,
        notes=payload.notes,
    )
    log_activity(
        db,
        action="quotation_applied",
        entity_type="subscription",
        entity_id=sub.id,
        user_id=current_user.id,
        details=f"Template {template_id} applied to create subscription {sub.subscription_number}"
    )
    sub.total_amount = round(sum(line.total for line in sub.lines), 2)
    return sub


# --- Subscription Core Endpoints ---
@router.get("/", response_model=List[SubscriptionResponse])
def list_subscriptions(
    customer_id: Optional[int] = None,
    status: Optional[SubscriptionStatus] = None,
    plan_id: Optional[int] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List subscriptions.
    Customers are restricted to their own subscriptions.
    Staff and admins can query across all customers with filters.
    """
    query = db.query(Subscription).options(selectinload(Subscription.lines).selectinload(SubscriptionLine.product), selectinload(Subscription.lines).selectinload(SubscriptionLine.variant), selectinload(Subscription.customer), selectinload(Subscription.plan).selectinload(Plan.product))

    if current_user.role == UserRole.customer:
        query = query.filter(Subscription.customer_id == current_user.id)
    else:
        if customer_id:
            query = query.filter(Subscription.customer_id == customer_id)

    if status:
        query = query.filter(Subscription.status == status)
    if plan_id:
        query = query.filter(Subscription.plan_id == plan_id)

    subscriptions = (
        query.order_by(Subscription.id.desc())
        .offset(pagination.skip)
        .limit(pagination.limit)
        .all()
    )

    # Attach computed total_amount
    for s in subscriptions:
        s.total_amount = round(sum(line.total for line in s.lines), 2)

    return subscriptions


@router.post("/", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def create_new_subscription(
    sub_in: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new subscription. Customers can self-subscribe.
    Staff and Admins can create subscriptions on behalf of any customer.
    """
    if current_user.role == UserRole.customer:
        sub_in.customer_id = current_user.id
    elif not sub_in.customer_id:
        sub_in.customer_id = current_user.id

    sub = create_subscription(db, sub_in, current_user)
    sub.total_amount = round(sum(line.total for line in sub.lines), 2)
    log_activity(
        db,
        action="subscription_created",
        entity_type="subscription",
        entity_id=sub.id,
        user_id=current_user.id,
        details=f"Subscription {sub.subscription_number} created for customer {sub.customer_id}"
    )
    return sub


@router.get("/{subscription_id}", response_model=SubscriptionResponse)
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get full details of a specific subscription."""
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if current_user.role == UserRole.customer and sub.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    sub.total_amount = round(sum(line.total for line in sub.lines), 2)
    return sub


@router.post("/{subscription_id}/transition", response_model=SubscriptionResponse)
def transition_status(
    subscription_id: int,
    transition: SubscriptionStatusTransition,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Advance subscription status with strict transition validation.
    """
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if current_user.role == UserRole.customer and sub.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Only staff/admin can confirm or manually activate outside standard checkout
    if current_user.role == UserRole.customer and transition.target_status in [SubscriptionStatus.active, SubscriptionStatus.confirmed]:
        # Customers can confirm their quotations
        if sub.status != SubscriptionStatus.quotation or transition.target_status != SubscriptionStatus.confirmed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer cannot perform this transition")

    updated_sub = transition_subscription_status(
        db,
        subscription_id=subscription_id,
        target_status=transition.target_status,
        reason=transition.reason,
    )
    updated_sub.total_amount = round(sum(line.total for line in updated_sub.lines), 2)
    log_activity(
        db,
        action="subscription_status_transition",
        entity_type="subscription",
        entity_id=updated_sub.id,
        user_id=current_user.id,
        details=f"Subscription {updated_sub.subscription_number} transitioned to {transition.target_status.value}"
    )
    return updated_sub


@router.post("/{subscription_id}/pause", response_model=SubscriptionResponse)
def pause_sub(
    subscription_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Pause an active subscription if plan allows."""
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if current_user.role == UserRole.customer and sub.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = pause_subscription(db, subscription_id, reason)
    updated.total_amount = round(sum(line.total for line in updated.lines), 2)
    log_activity(
        db,
        action="subscription_paused",
        entity_type="subscription",
        entity_id=updated.id,
        user_id=current_user.id,
        details=f"Subscription {updated.subscription_number} paused"
    )
    return updated


@router.post("/{subscription_id}/resume", response_model=SubscriptionResponse)
def resume_sub(
    subscription_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Resume a paused subscription."""
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if current_user.role == UserRole.customer and sub.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = resume_subscription(db, subscription_id, reason)
    updated.total_amount = round(sum(line.total for line in updated.lines), 2)
    log_activity(
        db,
        action="subscription_resumed",
        entity_type="subscription",
        entity_id=updated.id,
        user_id=current_user.id,
        details=f"Subscription {updated.subscription_number} resumed"
    )
    return updated


@router.post("/{subscription_id}/close", response_model=SubscriptionResponse)
def close_sub(
    subscription_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Close/Cancel subscription (checks plan's allow_early_close policy)."""
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if current_user.role == UserRole.customer and sub.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    updated = close_subscription(db, subscription_id, reason)
    updated.total_amount = round(sum(line.total for line in updated.lines), 2)
    log_activity(
        db,
        action="subscription_closed",
        entity_type="subscription",
        entity_id=updated.id,
        user_id=current_user.id,
        details=f"Subscription {updated.subscription_number} closed"
    )
    return updated


@router.post("/{subscription_id}/create-invoice", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice_for_subscription(
    subscription_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """Generate invoice directly from subscription with duplicate prevention."""
    inv = generate_invoice_from_subscription(db, subscription_id=subscription_id, force=force)
    paid, due = get_invoice_balance(db, inv.id)
    inv.amount_paid = paid
    inv.amount_due = due
    log_activity(
        db,
        action="invoice_generated_from_subscription",
        entity_type="invoice",
        entity_id=inv.id,
        user_id=staff_user.id,
        details=f"Generated invoice {inv.invoice_number} for subscription {subscription_id}"
    )
    return inv


@router.post("/{subscription_id}/renew", response_model=SubscriptionResponse)
def renew(subscription_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_active_user)):
    from datetime import datetime
    from app.services.calendar import advance
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if user.role == UserRole.customer and sub.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not sub.plan.allow_renewal or sub.status in (SubscriptionStatus.draft, SubscriptionStatus.quotation):
        raise HTTPException(status_code=400, detail="This subscription cannot be renewed.")
    sub.expiry_date = advance(max(sub.expiry_date or datetime.utcnow(), datetime.utcnow()), sub.plan.billing_cycle)
    if sub.status == SubscriptionStatus.closed:
        sub.status = SubscriptionStatus.confirmed
        sub.next_billing_date = datetime.utcnow()
    db.commit()
    sub.total_amount = round(sum(l.total for l in sub.lines), 2)
    log_activity(db, "subscription_renewed", "subscription", sub.id, user.id, f"Renewed {sub.subscription_number}")
    return sub
