from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from decimal import Decimal

from app.schemas.base import ValidatedModel, CurrencyModel

from app.models.payment import PaymentMethod, PaymentStatus


class PaymentBase(CurrencyModel):
    invoice_id: int
    amount: float = Field(ge=0.01)
    payment_method: PaymentMethod = PaymentMethod.credit_card
    reference_note: Optional[str] = None


class PaymentCreate(PaymentBase):
    @field_validator("amount")
    @classmethod
    def whole_paise(cls, value):
        number = Decimal(str(value))
        if number != number.quantize(Decimal("0.01")):
            raise ValueError("Enter an INR amount with at most two decimal places (paise)")
        return value

    payment_date: Optional[datetime] = None


class PaymentResponse(PaymentBase):
    id: int
    payment_number: str
    payment_date: datetime
    status: PaymentStatus
    created_at: datetime
    updated_at: datetime
    invoice_number: Optional[str] = None
    customer_name: Optional[str] = Field(default=None, min_length=2, max_length=255)

    model_config = ConfigDict(from_attributes=True)
