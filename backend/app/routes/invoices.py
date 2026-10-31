from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, and_
from app.database import get_db
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.user import User, UserRole
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    BulkInvoiceRequest,
    BulkInvoiceResponse,
)
from app.services.billing_service import (
    generate_invoice_from_subscription,
    generate_bulk_invoices,
    generate_invoice_number,
    get_invoice_balance,
)
from app.dependencies import (
    get_current_active_user,
    require_staff_or_admin,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("/", response_model=List[InvoiceResponse])
def list_invoices(
    customer_id: Optional[int] = None,
    status: Optional[InvoiceStatus] = None,
    subscription_id: Optional[int] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List invoices.
    Customers can only view their own invoices.
    Staff and Admins can query all invoices with filters.
    """
    query = db.query(Invoice).options(selectinload(Invoice.lines).selectinload(InvoiceLine.product), selectinload(Invoice.lines).selectinload(InvoiceLine.variant), selectinload(Invoice.customer), selectinload(Invoice.payments), selectinload(Invoice.subscription))

    if current_user.role == UserRole.customer:
        query = query.filter(Invoice.customer_id == current_user.id)
    else:
        if customer_id:
            query = query.filter(Invoice.customer_id == customer_id)

    if status == InvoiceStatus.overdue:
        query = query.filter(or_(Invoice.status == InvoiceStatus.overdue, and_(Invoice.status == InvoiceStatus.confirmed, Invoice.due_date < datetime.utcnow())))
    elif status:
        query = query.filter(Invoice.status == status)
    if subscription_id:
        query = query.filter(Invoice.subscription_id == subscription_id)

    invoices = (
        query.order_by(Invoice.issue_date.desc(), Invoice.id.desc())
        .offset(pagination.skip)
        .limit(pagination.limit)
        .all()
    )

    for inv in invoices:
        paid = round(sum(p.amount for p in inv.payments if p.status.value == "completed"), 2)
        inv.amount_paid = paid
        inv.amount_due = max(0, round(inv.total - paid, 2))

    return invoices


@router.post("/from-subscription/{subscription_id}", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice_from_sub(
    subscription_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """Generate an invoice from a subscription."""
    inv = generate_invoice_from_subscription(db, subscription_id=subscription_id, force=force)
    paid, due = get_invoice_balance(db, inv.id)
    inv.amount_paid = paid
    inv.amount_due = due
    log_activity(
        db,
        action="invoice_generated",
        entity_type="invoice",
        entity_id=inv.id,
        user_id=staff_user.id,
        details=f"Invoice {inv.invoice_number} created from subscription {subscription_id}"
    )
    return inv


@router.get("/billing-preview")
def billing_preview(db: Session = Depends(get_db), staff_user: User = Depends(require_staff_or_admin)):
    from app.services.billing_service import preview_billing
    return preview_billing(db)


@router.post("/bulk-generate", response_model=BulkInvoiceResponse)
def trigger_bulk_invoicing(
    payload: Optional[BulkInvoiceRequest] = None,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """
    Bulk invoice generation endpoint for billing cycle day.
    Generates invoices for all active subscriptions due for billing.
    """
    b_date = payload.billing_date if payload else None
    gen_count, skip_count, invoices = generate_bulk_invoices(db, billing_date=b_date)

    resp_invoices = []
    for inv in invoices:
        paid = round(sum(p.amount for p in inv.payments if p.status.value == "completed"), 2)
        inv.amount_paid = paid
        inv.amount_due = max(0, round(inv.total - paid, 2))
        resp_invoices.append(inv)

    log_activity(
        db,
        action="bulk_invoicing_executed",
        entity_type="billing",
        user_id=staff_user.id,
        details=f"Bulk billing generated {gen_count} invoices, skipped {skip_count}"
    )

    return BulkInvoiceResponse(
        generated_count=gen_count,
        skipped_count=skip_count,
        invoices=resp_invoices,
        message=f"Successfully generated {gen_count} invoices; {skip_count} subscriptions skipped (not due or already billed)."
    )


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_manual_invoice(
    invoice_in: InvoiceCreate,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """Manually create an invoice with specific lines (staff/admin only)."""
    customer = db.query(User).filter(User.id == invoice_in.customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    from app.models.product import Product, ProductVariant
    from app.models.subscription import Subscription
    from app.services.locking import lock_write
    lock_write(db)
    if customer.role != UserRole.customer:
        raise HTTPException(status_code=400, detail="Select a customer account.")
    if invoice_in.due_date < invoice_in.issue_date:
        raise HTTPException(status_code=400, detail="Due date must be on or after the invoice date.")
    if invoice_in.subscription_id:
        sub = db.query(Subscription).filter(Subscription.id == invoice_in.subscription_id).first()
        if not sub or sub.customer_id != customer.id:
            raise HTTPException(status_code=400, detail="The subscription does not belong to this customer.")
    for line in invoice_in.lines:
        product = db.get(Product, line.product_id)
        if not product or not product.is_active:
            raise HTTPException(status_code=400, detail="An invoice product is unavailable.")
        if line.variant_id:
            variant = db.get(ProductVariant, line.variant_id)
            if not variant or variant.product_id != product.id:
                raise HTTPException(status_code=400, detail="Invalid product variant.")
    subtotal = 0.0
    tax_total = 0.0
    for line in invoice_in.lines:
        line_sub = round(line.quantity * line.unit_price, 2)
        line_tax = round(line_sub * (line.tax_rate / 100.0), 2)
        subtotal += line_sub
        tax_total += line_tax

    total = round(subtotal + tax_total, 2)
    inv_number = generate_invoice_number(db)

    invoice = Invoice(
        invoice_number=inv_number,
        subscription_id=invoice_in.subscription_id,
        customer_id=invoice_in.customer_id,
        issue_date=invoice_in.issue_date or datetime.utcnow(),
        due_date=invoice_in.due_date,
        status=InvoiceStatus.draft,
        subtotal=subtotal,
        tax_amount=tax_total,
        discount_amount=0.0,
        total=total,
        notes=invoice_in.notes,
    )
    db.add(invoice)
    db.flush()

    for line in invoice_in.lines:
        line_sub = round(line.quantity * line.unit_price, 2)
        line_tot = round(line_sub * (1 + line.tax_rate / 100.0), 2)
        inv_line = InvoiceLine(
            invoice_id=invoice.id,
            product_id=line.product_id,
            variant_id=line.variant_id,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_rate=line.tax_rate,
            subtotal=line_sub,
            total=line_tot,
        )
        db.add(inv_line)

    db.commit()
    db.refresh(invoice)
    invoice.amount_paid = 0.0
    invoice.amount_due = invoice.total

    log_activity(
        db,
        action="manual_invoice_created",
        entity_type="invoice",
        entity_id=invoice.id,
        user_id=staff_user.id,
        details=f"Manual invoice {invoice.invoice_number} created for customer {invoice.customer_id}"
    )
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve full details of an invoice including lines and outstanding balance."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if current_user.role == UserRole.customer and inv.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    paid, due = get_invoice_balance(db, inv.id)
    inv.amount_paid = paid
    inv.amount_due = due
    return inv


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    inv_update: InvoiceUpdate,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """Update status, due date, or notes on an invoice (staff/admin only)."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    if inv_update.status is not None:
        allowed = {InvoiceStatus.draft: {InvoiceStatus.confirmed, InvoiceStatus.cancelled}, InvoiceStatus.confirmed: {InvoiceStatus.cancelled}, InvoiceStatus.overdue: {InvoiceStatus.cancelled}}
        if inv_update.status != inv.status and inv_update.status not in allowed.get(inv.status, set()):
            raise HTTPException(status_code=400, detail="This invoice transition is not allowed. Paid status is set only by payments.")
        paid, _ = get_invoice_balance(db, inv.id)
        if inv_update.status == InvoiceStatus.cancelled and paid > 0:
            raise HTTPException(status_code=400, detail="An invoice with payments cannot be cancelled.")
        inv.status = InvoiceStatus.paid if inv_update.status == InvoiceStatus.confirmed and inv.total == 0 else inv_update.status
    if inv_update.due_date is not None:
        inv.due_date = inv_update.due_date
    if inv_update.notes is not None:
        inv.notes = inv_update.notes

    db.commit()
    db.refresh(inv)
    paid, due = get_invoice_balance(db, inv.id)
    inv.amount_paid = paid
    inv.amount_due = due

    log_activity(
        db,
        action="invoice_updated",
        entity_type="invoice",
        entity_id=inv.id,
        user_id=staff_user.id,
        details=f"Invoice {inv.invoice_number} updated"
    )
    return inv


@router.post("/{invoice_id}/send")
def send_invoice(invoice_id: int, db: Session = Depends(get_db), staff: User = Depends(require_staff_or_admin)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv or inv.status in (InvoiceStatus.draft, InvoiceStatus.cancelled):
        raise HTTPException(status_code=400, detail="Only issued invoices can be sent.")
    from app.utils.email import send_invoice_notification
    delivered = send_invoice_notification(inv.customer.email, inv.invoice_number, inv.total, inv.due_date.strftime("%Y-%m-%d"))
    log_activity(db, "invoice_sent", "invoice", inv.id, staff.id, f"Invoice {inv.invoice_number} {'sent by SMTP' if delivered else 'saved to local outbox'}")
    return {"message": "Invoice sent by email." if delivered else "Invoice saved to the local email outbox. SMTP is not configured."}
