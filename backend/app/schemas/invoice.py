from datetime import datetime
from typing import Optional, List
from pydantic import model_validator, BaseModel, ConfigDict, Field

from app.schemas.base import ValidatedModel, CurrencyModel

from app.models.invoice import InvoiceStatus
from app.schemas.payment import PaymentResponse
from app.schemas.user import UserResponse
from app.schemas.product import ProductResponse, ProductVariantResponse


# Invoice Line Schemas
class InvoiceLineBase(CurrencyModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(default=0.0, ge=0.0)
    tax_rate: float = Field(default=0.0, ge=0.0)


class InvoiceLineCreate(InvoiceLineBase):
    pass


class InvoiceLineResponse(InvoiceLineBase):
    id: int
    invoice_id: int
    subtotal: float
    total: float
    product: Optional[ProductResponse] = None
    variant: Optional[ProductVariantResponse] = None

    model_config = ConfigDict(from_attributes=True)


# Invoice Schemas
class InvoiceBase(CurrencyModel):
    customer_id: int
    subscription_id: Optional[int] = None
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    lines: List[InvoiceLineCreate] = Field(min_length=1)


class InvoiceUpdate(ValidatedModel):
    status: Optional[InvoiceStatus] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class InvoiceResponse(InvoiceBase):
    id: int
    invoice_number: str
    subscription_number: Optional[str] = None
    status: InvoiceStatus
    subtotal: float
    tax_amount: float
    discount_amount: float
    total: float
    created_at: datetime
    updated_at: datetime
    payments: List[PaymentResponse] = []
    lines: List[InvoiceLineResponse] = []
    customer: Optional[UserResponse] = None
    amount_paid: Optional[float] = 0.0
    amount_due: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def overdue_status(self):
        if self.status == InvoiceStatus.confirmed and self.due_date < datetime.utcnow() and self.amount_due > 0:
            self.status = InvoiceStatus.overdue
        return self


class BulkInvoiceRequest(ValidatedModel):
    billing_date: Optional[datetime] = None


class BulkInvoiceResponse(ValidatedModel):
    generated_count: int
    skipped_count: int
    invoices: List[InvoiceResponse] = []
    message: str
