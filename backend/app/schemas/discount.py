from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.discount import DiscountType, DiscountAppliesTo


# Discount Schemas
class DiscountBase(BaseModel):
    name: str
    code: Optional[str] = None
    type: DiscountType
    value: float = Field(gt=0.0)
    min_purchase_amount: float = Field(default=0.0, ge=0.0)
    min_quantity: int = Field(default=1, ge=1)
    start_date: datetime = Field(default_factory=datetime.utcnow)
    end_date: Optional[datetime] = None
    max_uses: Optional[int] = Field(default=None, ge=1)
    applies_to: DiscountAppliesTo = DiscountAppliesTo.subscription
    product_id: Optional[int] = None
    is_active: bool = True


class DiscountCreate(DiscountBase):
    pass


class DiscountUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[DiscountType] = None
    value: Optional[float] = Field(default=None, gt=0.0)
    min_purchase_amount: Optional[float] = Field(default=None, ge=0.0)
    min_quantity: Optional[int] = Field(default=None, ge=1)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    max_uses: Optional[int] = None
    applies_to: Optional[DiscountAppliesTo] = None
    product_id: Optional[int] = None
    is_active: Optional[bool] = None


class DiscountResponse(DiscountBase):
    id: int
    current_uses: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Tax Rule Schemas
class TaxRuleBase(BaseModel):
    name: str
    rate: float = Field(ge=0.0)  # Percentage rate
    description: Optional[str] = None
    is_active: bool = True


class TaxRuleCreate(TaxRuleBase):
    pass


class TaxRuleUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[float] = Field(default=None, ge=0.0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TaxRuleResponse(TaxRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Activity Log Schema
class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
