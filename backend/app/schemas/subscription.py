from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from app.models.subscription import SubscriptionStatus
from app.schemas.user import UserResponse
from app.schemas.product import ProductResponse, ProductVariantResponse
from app.schemas.plan import PlanResponse


# Subscription Line Schemas
class SubscriptionLineBase(BaseModel):
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
class SubscriptionBase(BaseModel):
    customer_id: int
    plan_id: int
    start_date: datetime = Field(default_factory=datetime.utcnow)
    expiry_date: Optional[datetime] = None
    payment_terms: str = "Immediate"
    notes: Optional[str] = None


class SubscriptionCreate(BaseModel):
    customer_id: Optional[int] = None  # Inferred for customer role if omitted
    plan_id: int
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    payment_terms: Optional[str] = "Immediate"
    notes: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[int] = None
    expiry_date: Optional[datetime] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    lines: Optional[List[SubscriptionLineCreate]] = None


class SubscriptionStatusTransition(BaseModel):
    target_status: SubscriptionStatus
    reason: Optional[str] = None


class SubscriptionResponse(SubscriptionBase):
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
class QuotationTemplateBase(BaseModel):
    name: str
    plan_id: int
    validity_days: int = Field(default=30, ge=1)
    default_lines: Optional[str] = None
    is_active: bool = True


class QuotationTemplateCreate(QuotationTemplateBase):
    pass


class QuotationTemplateResponse(QuotationTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    plan: Optional[PlanResponse] = None

    model_config = ConfigDict(from_attributes=True)


class QuotationTemplateApply(BaseModel):
    customer_id: Optional[int] = None
    payment_terms: Optional[str] = "Immediate"
    start_date: Optional[datetime] = None
    notes: Optional[str] = None
