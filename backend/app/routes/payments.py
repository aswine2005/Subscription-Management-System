from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.invoice import Invoice
from app.models.user import User, UserRole
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.billing_service import record_payment
from app.utils.money import format_inr
from app.dependencies import (
    get_current_active_user,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/", response_model=List[PaymentResponse])
def list_payments(
    invoice_id: Optional[int] = None,
    payment_method: Optional[PaymentMethod] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List payments with pagination and filters.
    Customers can only inspect payments against their invoices.
    """
    query = db.query(Payment).options(selectinload(Payment.invoice).selectinload(Invoice.customer)).join(Invoice)

    if current_user.role == UserRole.customer:
        query = query.filter(Invoice.customer_id == current_user.id)

    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    if payment_method:
        query = query.filter(Payment.payment_method == payment_method)

    payments = (
        query.order_by(Payment.payment_date.desc(), Payment.id.desc())
        .offset(pagination.skip)
        .limit(pagination.limit)
        .all()
    )

    # Decorate responses with invoice_number and customer_name
    results = []
    for p in payments:
        resp = PaymentResponse.model_validate(p)
        resp.invoice_number = p.invoice.invoice_number if p.invoice else None
        resp.customer_name = p.invoice.customer.full_name if p.invoice and p.invoice.customer else None
        results.append(resp)

    return results


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def make_payment(
    payment_in: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Record payment against an invoice.
    Supports partial payments and automatically marks invoice paid once balance is cleared.
    """
    payment, invoice, amount_due = record_payment(db, payment_in, current_user)

    log_activity(
        db,
        action="payment_recorded",
        entity_type="payment",
        entity_id=payment.id,
        user_id=current_user.id,
        details=f"Payment {payment.payment_number} ({format_inr(payment.amount)}) recorded for {invoice.invoice_number}. Remaining due: {format_inr(amount_due)}"
    )

    resp = PaymentResponse.model_validate(payment)
    resp.invoice_number = invoice.invoice_number
    resp.customer_name = invoice.customer.full_name if invoice.customer else None
    return resp


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single payment record details."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if current_user.role == UserRole.customer and payment.invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    resp = PaymentResponse.model_validate(payment)
    resp.invoice_number = payment.invoice.invoice_number if payment.invoice else None
    resp.customer_name = payment.invoice.customer.full_name if payment.invoice and payment.invoice.customer else None
    return resp
