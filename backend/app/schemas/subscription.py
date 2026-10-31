from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
import json

from app.schemas.base import ValidatedModel, CurrencyModel

from app.models.subscription import SubscriptionStatus
from app.schemas.user import UserResponse
from app.schemas.product import ProductResponse, ProductVariantResponse
from app.schemas.plan import PlanResponse


# Subscription Line Schemas
class SubscriptionLineBase(CurrencyModel):
    product_id: int
    variant_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(default=0.0, ge=0.0)
    tax_rate: float = Field(default=0.0, ge=0.0)


class SubscriptionLineCreate(SubscriptionLineBase):
    pass


class SubscriptionLineResponse(SubscriptionLineBase):
    id: int
    subscription_id: int
    subtotal: float
    total: float
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None
    variant: Optional[ProductVariantResponse] = None

    model_config = ConfigDict(from_attributes=True)


# Subscription Schemas
class SubscriptionBase(CurrencyModel):
    customer_id: int
    plan_id: int
    start_date: datetime = Field(default_factory=datetime.utcnow)
    expiry_date: Optional[datetime] = None
    payment_terms: str = "Immediate"
    notes: Optional[str] = None


class SubscriptionCreate(CurrencyModel):
    customer_id: Optional[int] = None  # Inferred for customer role if omitted
    plan_id: int
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    payment_terms: Optional[str] = "Immediate"
    notes: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionUpdate(ValidatedModel):
    plan_id: Optional[int] = None
    expiry_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionStatusTransition(ValidatedModel):
    target_status: SubscriptionStatus
    reason: Optional[str] = None


class SubscriptionResponse(SubscriptionBase):
    quotation_valid_until: Optional[datetime] = None
    id: int
    subscription_number: str
    status: SubscriptionStatus
    created_by: Optional[int] = None
    next_billing_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    lines: List[SubscriptionLineResponse] = []
    customer: Optional[UserResponse] = None
    plan: Optional[PlanResponse] = None
    total_amount: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)


# Quotation Template Schemas
class QuotationTemplateBase(ValidatedModel):
    name: str = Field(min_length=2, max_length=255)
    plan_id: int
    validity_days: int = Field(default=30, ge=1)
    default_lines: Optional[str] = Field(default=None, max_length=50000)
    is_active: bool = True


class QuotationTemplateCreate(QuotationTemplateBase):
    @field_validator("default_lines")
    @classmethod
    def valid_lines(cls, value):
        if value is None:
            return None
        try:
            parsed = json.loads(value)
            if not isinstance(parsed, list) or not parsed or len(parsed) > 100:
                raise ValueError("Use between one and 100 product lines")
            lines = [SubscriptionLineCreate.model_validate(line) for line in parsed]
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid template product lines: {exc}") from exc
        return json.dumps([line.model_dump(mode="json", exclude_unset=True) for line in lines])


class QuotationTemplateResponse(QuotationTemplateBase):
    currency: str = "INR"
    quoted_subtotal: Optional[float] = None
    is_available: bool = True
    unavailable_reason: Optional[str] = None
    line_count: int = 1
    id: int
    created_at: datetime
    updated_at: datetime
    plan: Optional[PlanResponse] = None

    model_config = ConfigDict(from_attributes=True)


class QuotationTemplateApply(ValidatedModel):
    customer_id: Optional[int] = None
    payment_terms: Optional[str] = "Immediate"
    start_date: Optional[datetime] = None
    notes: Optional[str] = None
