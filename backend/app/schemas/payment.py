from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.payment import PaymentMethod, PaymentStatus


class PaymentBase(BaseModel):
    invoice_id: int
    amount: float = Field(gt=0.0)
    payment_method: PaymentMethod = PaymentMethod.credit_card
    reference_note: Optional[str] = None


class PaymentCreate(PaymentBase):
    payment_date: Optional[datetime] = None


class PaymentResponse(PaymentBase):
    id: int
    payment_number: str
    payment_date: datetime
    status: PaymentStatus
    created_at: datetime
    updated_at: datetime
    invoice_number: Optional[str] = None
    customer_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
