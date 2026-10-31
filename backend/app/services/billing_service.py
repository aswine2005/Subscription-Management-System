from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from app.models.subscription import Subscription, SubscriptionStatus, SubscriptionLine
from app.models.plan import BillingCycle
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.discount import Discount, TaxRule, DiscountType, DiscountAppliesTo
from app.models.user import User
from app.schemas.payment import PaymentCreate
from app.utils.money import CURRENCY_CODE, format_inr


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


def find_applicable_discount(db, subtotal, total_quantity, product_ids, reference_date, lines=None, usage=None, discounts=None):
    if discounts is None:
        discounts = db.query(Discount).filter(Discount.is_active.is_(True), Discount.start_date <= reference_date).order_by(Discount.id).all()
    best, best_amount = None, 0.0
    for disc in discounts:
        used = usage.get(disc.id, disc.current_uses) if usage is not None else disc.current_uses
        if (disc.end_date and disc.end_date < reference_date) or (disc.max_uses and used >= disc.max_uses):
            continue
        eligible = subtotal
        quantity = total_quantity
        if disc.applies_to == DiscountAppliesTo.product:
            if not disc.product_id or disc.product_id not in product_ids:
                continue
            if lines is not None:
                eligible = sum(l["subtotal"] for l in lines if l["product_id"] == disc.product_id)
                quantity = sum(l["quantity"] for l in lines if l["product_id"] == disc.product_id)
        if eligible < disc.min_purchase_amount or quantity < disc.min_quantity:
            continue
        amount = min(eligible, round(eligible * disc.value / 100, 2) if disc.type == DiscountType.percentage else disc.value)
        if amount > best_amount:
            best, best_amount = disc, amount
    return (best, round(best_amount, 2)) if best else None


def quote_subscription(db, subscription, now, usage=None, system_tax=None, discounts=None):
    if system_tax is None:
        system_tax = get_active_tax_rate(db)
    lines = []
    for line in subscription.lines:
        subtotal = round(line.quantity * line.unit_price, 2)
        rate = line.tax_rate if line.tax_rate > 0 else system_tax
        lines.append(dict(product_id=line.product_id, variant_id=line.variant_id, quantity=line.quantity,
                          unit_price=line.unit_price, tax_rate=rate, subtotal=subtotal, total=round(subtotal * (1 + rate / 100), 2)))
    subtotal = round(sum(l["subtotal"] for l in lines), 2)
    result = find_applicable_discount(db, subtotal, sum(l["quantity"] for l in lines), [l["product_id"] for l in lines], now, lines, usage, discounts)
    discount, amount = result if result else (None, 0.0)
    eligible = [l for l in lines if not discount or discount.applies_to != DiscountAppliesTo.product or l["product_id"] == discount.product_id]
    eligible_subtotal = sum(l["subtotal"] for l in eligible)
    taxes = 0.0
    for l in lines:
        allocation = amount * l["subtotal"] / eligible_subtotal if l in eligible and eligible_subtotal else 0.0
        taxes += round(max(0, l["subtotal"] - allocation) * l["tax_rate"] / 100, 2)
    tax = round(taxes, 2)
    return dict(subtotal=subtotal, discount_amount=amount, tax_amount=tax, total=round(subtotal-amount+tax, 2), discount=discount, lines=lines)


def skip_reason(db, sub, now, claims=None, invoices_by_sub=None):
    from app.services.calendar import billing_window
    from app.models.billing_claim import BillingClaim
    if sub.start_date > now:
        return "Starts in the future"
    if sub.expiry_date and sub.expiry_date < now and sub.plan.auto_close:
        return "Contract expired · auto-close enabled"
    if sub.next_billing_date and sub.next_billing_date > now:
        return "Next billing date has not arrived"
    start, end, period = billing_window(sub.start_date, sub.plan.billing_cycle, now)
    claimed = f"{sub.id}:{period}" in claims if claims is not None else db.get(BillingClaim, f"{sub.id}:{period}")
    if claimed:
        return "Already billed for this period"
    existing = any(start <= date < end for date in invoices_by_sub.get(sub.id, [])) if invoices_by_sub is not None else db.query(Invoice).filter(Invoice.subscription_id == sub.id, Invoice.issue_date >= start, Invoice.issue_date < end, Invoice.status != InvoiceStatus.cancelled).first()
    return "Already billed for this period" if existing else None


def preview_billing(db, billing_date=None):
    now = billing_date or datetime.utcnow()
    from app.models.billing_claim import BillingClaim
    from app.config import settings
    from collections import defaultdict
    subs = db.query(Subscription).options(selectinload(Subscription.lines), selectinload(Subscription.plan), selectinload(Subscription.customer)).filter(Subscription.status == SubscriptionStatus.active).order_by(Subscription.id).all()
    claims = {c.key for c in db.query(BillingClaim).all()}
    invoices_by_sub = defaultdict(list)
    for sub_id, issue_date in db.query(Invoice.subscription_id, Invoice.issue_date).filter(Invoice.status != InvoiceStatus.cancelled):
        invoices_by_sub[sub_id].append(issue_date)
    taxes = get_active_tax_rate(db)
    discounts = db.query(Discount).filter(Discount.is_active.is_(True), Discount.start_date <= now).order_by(Discount.id).all()
    rows, usage = [], {}
    for sub in subs:
        reason = skip_reason(db, sub, now, claims, invoices_by_sub)
        q = quote_subscription(db, sub, now, usage, taxes, discounts)
        if not reason and q["discount"]:
            disc = q["discount"]
            usage[disc.id] = usage.get(disc.id, disc.current_uses) + 1
        rows.append(dict(id=sub.id, subscription_number=sub.subscription_number, customer_name=sub.customer.full_name,
                         plan_name=sub.plan.name, billing_cycle=sub.plan.billing_cycle.value, next_billing_date=sub.next_billing_date,
                         status="skipped" if reason else "ready", reason=reason or "Ready to invoice", subtotal=q["subtotal"],
                         tax_amount=q["tax_amount"], discount_amount=q["discount_amount"], total=q["total"],
                         discount_name=q["discount"].name if q["discount"] else None))
    ready = [row for row in rows if row["status"] == "ready"]
    return dict(currency=CURRENCY_CODE, automation_enabled=settings.AUTO_BILLING, billing_date=now, ready_count=len(ready), skipped_count=len(rows)-len(ready),
                subtotal=round(sum(r["subtotal"] for r in ready),2), discount_amount=round(sum(r["discount_amount"] for r in ready),2),
                tax_amount=round(sum(r["tax_amount"] for r in ready),2), total=round(sum(r["total"] for r in ready),2), rows=rows)


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
    from app.services.locking import lock_write
    lock_write(db)
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    if subscription.status not in [SubscriptionStatus.active, SubscriptionStatus.confirmed]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate invoice for subscription in '{subscription.status.value}' status. Must be confirmed or active."
        )

    now = issue_date or datetime.utcnow()

    # No bypass for duplicate billing: the same contract period is claimed only once.
    reason = skip_reason(db, subscription, now)
    if reason:
        raise HTTPException(status_code=409, detail=reason)

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

    q = quote_subscription(db, subscription, now)
    subtotal, discount_amount, total_tax, total_amount = q["subtotal"], q["discount_amount"], q["tax_amount"], q["total"]
    line_snapshots = q["lines"]
    if q["discount"]:
        q["discount"].current_uses += 1
    inv_number = generate_invoice_number(db)

    invoice = Invoice(
        invoice_number=inv_number,
        subscription_id=subscription.id,
        customer_id=subscription.customer_id,
        issue_date=now,
        due_date=due_date,
        status=InvoiceStatus.draft,
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

    from app.services.calendar import billing_window
    from app.models.billing_claim import BillingClaim
    from sqlalchemy.exc import IntegrityError
    _, next_date, period = billing_window(subscription.start_date, subscription.plan.billing_cycle, now)
    subscription.next_billing_date = next_date
    db.add(BillingClaim(key=f"{subscription.id}:{period}", invoice_id=invoice.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This billing period was already processed. Refresh the preview.")
    db.refresh(invoice)

    # Delivery happens explicitly through the Send invoice action.

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
    ).order_by(Subscription.id).all()

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
            db.rollback()
            raise

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
    from app.services.locking import lock_write
    lock_write(db)
    invoice = db.query(Invoice).filter(Invoice.id == payment_in.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if invoice.status == InvoiceStatus.draft:
        raise HTTPException(status_code=400, detail="Confirm this invoice before recording a payment.")
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

    if current_user.role.value == "customer":
        raise HTTPException(status_code=403, detail="Payments must be recorded by the billing team after receipt.")

    # Check user permissions (customer can only pay their own invoices)
    if current_user.role.value == "customer" and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Calculate existing completed payments
    existing_paid = db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
        Payment.invoice_id == invoice.id,
        Payment.status == PaymentStatus.completed
    ).scalar() or 0.0

    outstanding = round(invoice.total - existing_paid, 2)
    if round(payment_in.amount, 2) > outstanding:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({format_inr(payment_in.amount)}) exceeds outstanding balance ({format_inr(outstanding)})."
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
