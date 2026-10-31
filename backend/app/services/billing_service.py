from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.plan import BillingCycle
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.discount import Discount, TaxRule, DiscountType, DiscountAppliesTo
from app.models.user import User
from app.schemas.payment import PaymentCreate
from app.utils.email import send_invoice_notification


def generate_invoice_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"INV-{year}-"
    last_inv = (
        db.query(Invoice.invoice_number)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )
    if last_inv and last_inv[0]:
        try:
            last_seq = int(last_inv[0].split("-")[-1])
            seq = last_seq + 1
        except ValueError:
            seq = db.query(Invoice).count() + 1
    else:
        seq = db.query(Invoice).count() + 1
    return f"{prefix}{seq:05d}"


def generate_payment_number(db: Session) -> str:
    year = datetime.utcnow().year
    prefix = f"PAY-{year}-"
    last_pay = (
        db.query(Payment.payment_number)
        .filter(Payment.payment_number.like(f"{prefix}%"))
        .order_by(Payment.id.desc())
        .first()
    )
    if last_pay and last_pay[0]:
        try:
            last_seq = int(last_pay[0].split("-")[-1])
            seq = last_seq + 1
        except ValueError:
            seq = db.query(Payment).count() + 1
    else:
        seq = db.query(Payment).count() + 1
    return f"{prefix}{seq:05d}"


def get_billing_period_cutoff(cycle: BillingCycle, reference_date: datetime) -> datetime:
    if cycle == BillingCycle.daily:
        return reference_date - timedelta(hours=20)
    elif cycle == BillingCycle.weekly:
        return reference_date - timedelta(days=6)
    elif cycle == BillingCycle.monthly:
        return reference_date - timedelta(days=27)
    elif cycle == BillingCycle.yearly:
        return reference_date - timedelta(days=360)
    return reference_date - timedelta(days=27)


def find_applicable_discount(
    db: Session,
    subtotal: float,
    total_quantity: int,
    product_ids: List[int],
    reference_date: datetime
) -> Optional[Tuple[Discount, float]]:
    """
    Find best applicable discount for the invoice.
    Returns tuple of (Discount, discount_amount).
    """
    discounts = db.query(Discount).filter(
        Discount.is_active.is_(True),
        Discount.start_date <= reference_date,
    ).all()

    best_discount: Optional[Discount] = None
    max_discount_amount = 0.0

    for disc in discounts:
        if disc.end_date and disc.end_date < reference_date:
            continue
        if disc.max_uses and disc.current_uses >= disc.max_uses:
            continue
        if subtotal < disc.min_purchase_amount:
            continue
        if total_quantity < disc.min_quantity:
            continue

        if disc.applies_to == DiscountAppliesTo.product and disc.product_id:
            if disc.product_id not in product_ids:
                continue

        # Calculate discount amount
        if disc.type == DiscountType.percentage:
            amount = round(subtotal * (disc.value / 100.0), 2)
        else:
            amount = round(min(disc.value, subtotal), 2)

        if amount > max_discount_amount:
            max_discount_amount = amount
            best_discount = disc

    if best_discount and max_discount_amount > 0:
        return best_discount, max_discount_amount
    return None


def get_active_tax_rate(db: Session) -> float:
    """Calculate aggregate tax rate from active tax rules."""
    active_taxes = db.query(TaxRule).filter(TaxRule.is_active.is_(True)).all()
    if not active_taxes:
        return 0.0
    return sum(t.rate for t in active_taxes)


def generate_invoice_from_subscription(
    db: Session,
    subscription_id: int,
    issue_date: Optional[datetime] = None,
    force: bool = False
) -> Invoice:
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if subscription.status not in [SubscriptionStatus.active, SubscriptionStatus.confirmed]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate invoice for subscription in '{subscription.status.value}' status. Must be confirmed or active."
        )

    now = issue_date or datetime.utcnow()

    # Prevent duplicate billing for the current period
    if not force:
        period_cutoff = get_billing_period_cutoff(subscription.plan.billing_cycle, now)
        recent_invoice = db.query(Invoice).filter(
            Invoice.subscription_id == subscription.id,
            Invoice.issue_date >= period_cutoff,
            Invoice.status != InvoiceStatus.cancelled
        ).first()

        if recent_invoice:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invoice already generated for subscription {subscription.subscription_number} in current billing cycle (Invoice: {recent_invoice.invoice_number})."
            )

    # Calculate due date based on payment terms
    terms_days = 0
    terms_lower = (subscription.payment_terms or "").lower()
    if "net 15" in terms_lower:
        terms_days = 15
    elif "net 30" in terms_lower:
        terms_days = 30
    elif "net 60" in terms_lower:
        terms_days = 60
    elif "immediate" in terms_lower:
        terms_days = 0
    else:
        terms_days = 15
    due_date = now + timedelta(days=terms_days)

    # Compute subtotal and lines
    subtotal = 0.0
    total_quantity = 0
    product_ids: List[int] = []
    line_snapshots = []

    active_system_tax = get_active_tax_rate(db)

    for sub_line in subscription.lines:
        line_subtotal = round(sub_line.quantity * sub_line.unit_price, 2)
        # Apply tax: use line tax rate if specified, else active system tax rate
        tax_rate = sub_line.tax_rate if sub_line.tax_rate > 0 else active_system_tax
        line_tax = round(line_subtotal * (tax_rate / 100.0), 2)
        line_total = round(line_subtotal + line_tax, 2)

        subtotal += line_subtotal
        total_quantity += sub_line.quantity
        product_ids.append(sub_line.product_id)

        line_snapshots.append({
            "product_id": sub_line.product_id,
            "variant_id": sub_line.variant_id,
            "quantity": sub_line.quantity,
            "unit_price": sub_line.unit_price,
            "tax_rate": tax_rate,
            "subtotal": line_subtotal,
            "total": line_total,
        })

    subtotal = round(subtotal, 2)

    # Check and apply discounts
    discount_result = find_applicable_discount(db, subtotal, total_quantity, product_ids, now)
    discount_amount = 0.0
    if discount_result:
        matched_discount, discount_amount = discount_result
        matched_discount.current_uses += 1

    # Tax on discounted or original subtotal
    taxable_amount = max(0.0, subtotal - discount_amount)
    total_tax = round(sum(l["total"] - l["subtotal"] for l in line_snapshots), 2)
    # If a discount was applied across the invoice, scale total_tax proportionally
    if subtotal > 0 and discount_amount > 0:
        total_tax = round(total_tax * (taxable_amount / subtotal), 2)

    total_amount = round(taxable_amount + total_tax, 2)
    inv_number = generate_invoice_number(db)

    invoice = Invoice(
        invoice_number=inv_number,
        subscription_id=subscription.id,
        customer_id=subscription.customer_id,
        issue_date=now,
        due_date=due_date,
        status=InvoiceStatus.confirmed,
        subtotal=subtotal,
        tax_amount=total_tax,
        discount_amount=discount_amount,
        total=total_amount,
        notes=f"Auto-generated for subscription {subscription.subscription_number} ({subscription.plan.name})",
    )
    db.add(invoice)
    db.flush()

    for item in line_snapshots:
        inv_line = InvoiceLine(
            invoice_id=invoice.id,
            product_id=item["product_id"],
            variant_id=item["variant_id"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            tax_rate=item["tax_rate"],
            subtotal=item["subtotal"],
            total=item["total"],
        )
        db.add(inv_line)

    # Advance subscription next_billing_date
    subscription.next_billing_date = now + (
        timedelta(days=1) if subscription.plan.billing_cycle == BillingCycle.daily
        else timedelta(weeks=1) if subscription.plan.billing_cycle == BillingCycle.weekly
        else timedelta(days=30) if subscription.plan.billing_cycle == BillingCycle.monthly
        else timedelta(days=365)
    )

    db.commit()
    db.refresh(invoice)

    # Trigger simulated email notification
    if subscription.customer and subscription.customer.email:
        send_invoice_notification(
            to_email=subscription.customer.email,
            invoice_number=invoice.invoice_number,
            total_amount=invoice.total,
            due_date=invoice.due_date.strftime("%Y-%m-%d")
        )

    return invoice


def generate_bulk_invoices(
    db: Session,
    billing_date: Optional[datetime] = None
) -> Tuple[int, int, List[Invoice]]:
    """
    Bulk generation endpoint for billing day.
    Scans all active subscriptions and generates due invoices.
    """
    now = billing_date or datetime.utcnow()
    active_subs = db.query(Subscription).filter(
        Subscription.status == SubscriptionStatus.active
    ).all()

    generated_invoices: List[Invoice] = []
    skipped_count = 0

    for sub in active_subs:
        try:
            # Check if next_billing_date is due or past
            if sub.next_billing_date and sub.next_billing_date > now:
                skipped_count += 1
                continue

            inv = generate_invoice_from_subscription(db, sub.id, issue_date=now, force=False)
            generated_invoices.append(inv)
        except HTTPException as e:
            if e.status_code == status.HTTP_409_CONFLICT:
                skipped_count += 1
            else:
                skipped_count += 1
        except Exception:
            skipped_count += 1

    return len(generated_invoices), skipped_count, generated_invoices


def record_payment(
    db: Session,
    payment_in: PaymentCreate,
    current_user: User
) -> Tuple[Payment, Invoice, float]:
    """
    Records payment against invoice.
    Supports partial payments.
    Auto-updates invoice to 'paid' when outstanding balance reaches 0.
    Returns (payment, invoice, amount_due).
    """
    invoice = db.query(Invoice).filter(Invoice.id == payment_in.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.status == InvoiceStatus.paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice {invoice.invoice_number} is already fully paid."
        )

    if invoice.status == InvoiceStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record payment for cancelled invoice {invoice.invoice_number}."
        )

    # Check user permissions (customer can only pay their own invoices)
    if current_user.role.value == "customer" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Calculate existing completed payments
    existing_paid = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
        Payment.invoice_id == invoice.id,
        Payment.status == PaymentStatus.completed
    ).scalar() or 0.0

    outstanding = round(invoice.total - existing_paid, 2)
    if payment_in.amount > outstanding + 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount (${payment_in.amount:.2f}) exceeds outstanding balance (${outstanding:.2f})."
        )

    pay_number = generate_payment_number(db)
    payment = Payment(
        payment_number=pay_number,
        invoice_id=invoice.id,
        amount=round(payment_in.amount, 2),
        payment_date=payment_in.payment_date or datetime.utcnow(),
        payment_method=payment_in.payment_method,
        reference_note=payment_in.reference_note,
        status=PaymentStatus.completed,
    )
    db.add(payment)
    db.flush()

    new_total_paid = round(existing_paid + payment.amount, 2)
    amount_due = max(0.0, round(invoice.total - new_total_paid, 2))

    if amount_due <= 0.001:
        invoice.status = InvoiceStatus.paid

    db.commit()
    db.refresh(payment)
    db.refresh(invoice)
    return payment, invoice, amount_due


def get_invoice_balance(db: Session, invoice_id: int) -> Tuple[float, float]:
    """Returns (amount_paid, amount_due)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return 0.0, 0.0
    paid = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
        Payment.invoice_id == invoice.id,
        Payment.status == PaymentStatus.completed
    ).scalar() or 0.0
    due = max(0.0, round(invoice.total - paid, 2))
    return round(paid, 2), due
