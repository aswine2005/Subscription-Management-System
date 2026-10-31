import json
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus, QuotationTemplate
from app.models.plan import Plan, BillingCycle
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate, SubscriptionLineCreate


def generate_subscription_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"SUB-{year}-"
    last_sub = (
        db.query(Subscription.subscription_number)
        .filter(Subscription.subscription_number.like(f"{prefix}%"))
        .order_by(Subscription.id.desc())
        .first()
    )
    if last_sub and last_sub[0]:
        try:
            last_seq = int(last_sub[0].split("-")[-1])
            seq = last_seq + 1
        except ValueError:
            seq = db.query(Subscription).count() + 1
    else:
        seq = db.query(Subscription).count() + 1
    return f"{prefix}{seq:05d}"


def calculate_next_billing_date(start_date: datetime, cycle: BillingCycle) -> datetime:
    if cycle == BillingCycle.daily:
        return start_date + timedelta(days=1)
    elif cycle == BillingCycle.weekly:
        return start_date + timedelta(weeks=1)
    elif cycle == BillingCycle.monthly:
        return start_date + timedelta(days=30)
    elif cycle == BillingCycle.yearly:
        return start_date + timedelta(days=365)
    return start_date + timedelta(days=30)


def create_subscription(
    db: Session,
    sub_data: SubscriptionCreate,
    current_user: User
) -> Subscription:
    # Verify customer exists
    customer_id = sub_data.customer_id or current_user.id
    customer = db.query(User).filter(User.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Verify plan exists and is active
    plan = db.query(Plan).filter(Plan.id == sub_data.plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot subscribe to an inactive plan")

    start_date = sub_data.start_date or datetime.utcnow()
    next_billing = calculate_next_billing_date(start_date, plan.billing_cycle)
    sub_number = generate_subscription_number(db)

    subscription = Subscription(
        subscription_number=sub_number,
        customer_id=customer_id,
        plan_id=plan.id,
        start_date=start_date,
        expiry_date=sub_data.expiry_date,
        next_billing_date=next_billing,
        payment_terms=sub_data.payment_terms or "Immediate",
        status=SubscriptionStatus.draft,
        created_by=current_user.id,
        notes=sub_data.notes,
    )
    db.add(subscription)
    db.flush()

    # Subscription lines
    if sub_data.lines and len(sub_data.lines) > 0:
        for line_in in sub_data.lines:
            product = db.query(Product).filter(Product.id == line_in.product_id).first()
            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {line_in.product_id} not found")

            unit_price = line_in.unit_price if line_in.unit_price > 0 else product.sales_price
            if line_in.variant_id:
                variant = db.query(ProductVariant).filter(
                    ProductVariant.id == line_in.variant_id,
                    ProductVariant.product_id == product.id
                ).first()
                if variant:
                    unit_price += variant.additional_price

            subtotal = round(line_in.quantity * unit_price, 2)
            tax_rate = line_in.tax_rate
            total = round(subtotal * (1 + (tax_rate / 100.0)), 2)

            sub_line = SubscriptionLine(
                subscription_id=subscription.id,
                product_id=product.id,
                variant_id=line_in.variant_id,
                quantity=line_in.quantity,
                unit_price=unit_price,
                tax_rate=tax_rate,
                subtotal=subtotal,
                total=total,
            )
            db.add(sub_line)
    else:
        # Default line using the Plan's core product
        product = plan.product
        unit_price = plan.price
        subtotal = round(plan.min_quantity * unit_price, 2)
        total = subtotal

        sub_line = SubscriptionLine(
            subscription_id=subscription.id,
            product_id=product.id,
            variant_id=None,
            quantity=plan.min_quantity,
            unit_price=unit_price,
            tax_rate=0.0,
            subtotal=subtotal,
            total=total,
        )
        db.add(sub_line)

    db.commit()
    db.refresh(subscription)
    return subscription


VALID_TRANSITIONS = {
    SubscriptionStatus.draft: {SubscriptionStatus.quotation, SubscriptionStatus.confirmed, SubscriptionStatus.closed},
    SubscriptionStatus.quotation: {SubscriptionStatus.confirmed, SubscriptionStatus.closed},
    SubscriptionStatus.confirmed: {SubscriptionStatus.active, SubscriptionStatus.closed},
    SubscriptionStatus.active: {SubscriptionStatus.paused, SubscriptionStatus.closed},
    SubscriptionStatus.paused: {SubscriptionStatus.active, SubscriptionStatus.closed},
    SubscriptionStatus.closed: set(),  # terminal state
}


def transition_subscription_status(
    db: Session,
    subscription_id: int,
    target_status: SubscriptionStatus,
    reason: Optional[str] = None
) -> Subscription:
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    current_status = subscription.status
    if current_status == target_status:
        return subscription

    allowed_targets = VALID_TRANSITIONS.get(current_status, set())
    if target_status not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Illegal status transition from '{current_status.value}' to '{target_status.value}'. "
                   f"Allowed transitions: {[s.value for s in allowed_targets]}"
        )

    # Business rule validations
    if target_status == SubscriptionStatus.paused:
        if not subscription.plan.allow_pause:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Plan '{subscription.plan.name}' does not allow pausing subscriptions."
            )

    if target_status == SubscriptionStatus.closed:
        if current_status == SubscriptionStatus.active and not subscription.plan.allow_early_close:
            now = datetime.utcnow()
            if subscription.expiry_date and subscription.expiry_date > now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Plan '{subscription.plan.name}' does not allow early closure before expiry date."
                )

    subscription.status = target_status
    if reason:
        existing_notes = subscription.notes or ""
        subscription.notes = f"{existing_notes}\n[{datetime.utcnow().isoformat()}] Status changed to {target_status.value}: {reason}".strip()

    db.commit()
    db.refresh(subscription)
    return subscription


def pause_subscription(db: Session, subscription_id: int, reason: Optional[str] = None) -> Subscription:
    return transition_subscription_status(db, subscription_id, SubscriptionStatus.paused, reason)


def resume_subscription(db: Session, subscription_id: int, reason: Optional[str] = None) -> Subscription:
    return transition_subscription_status(db, subscription_id, SubscriptionStatus.active, reason)


def close_subscription(db: Session, subscription_id: int, reason: Optional[str] = None) -> Subscription:
    return transition_subscription_status(db, subscription_id, SubscriptionStatus.closed, reason)


def create_subscription_from_template(
    db: Session,
    template_id: int,
    customer_id: int,
    current_user: User,
    payment_terms: str = "Immediate",
    start_date: Optional[datetime] = None,
    notes: Optional[str] = None,
) -> Subscription:
    template = db.query(QuotationTemplate).filter(QuotationTemplate.id == template_id).first()
    if not template or not template.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation template not found or inactive")

    lines_data: List[SubscriptionLineCreate] = []
    if template.default_lines:
        try:
            parsed = json.loads(template.default_lines)
            for item in parsed:
                lines_data.append(SubscriptionLineCreate(
                    product_id=item.get("product_id"),
                    variant_id=item.get("variant_id"),
                    quantity=item.get("quantity", 1),
                    unit_price=item.get("unit_price", 0.0),
                    tax_rate=item.get("tax_rate", 0.0),
                ))
        except Exception:
            pass

    expiry = (start_date or datetime.utcnow()) + timedelta(days=template.validity_days)
    sub_in = SubscriptionCreate(
        customer_id=customer_id,
        plan_id=template.plan_id,
        start_date=start_date,
        expiry_date=expiry,
        payment_terms=payment_terms,
        notes=notes or f"Created from quotation template: {template.name}",
        lines=lines_data if lines_data else None,
    )
    new_sub = create_subscription(db, sub_in, current_user)
    # Transition to quotation status
    new_sub.status = SubscriptionStatus.quotation
    db.commit()
    db.refresh(new_sub)
    return new_sub
