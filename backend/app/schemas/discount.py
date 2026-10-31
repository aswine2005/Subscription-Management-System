from datetime import datetime
from typing import Optional
from pydantic import model_validator, BaseModel, ConfigDict, Field

from app.schemas.base import ValidatedModel, CurrencyModel

from app.models.discount import DiscountType, DiscountAppliesTo


# Discount Schemas
class DiscountBase(CurrencyModel):
    name: str = Field(min_length=2, max_length=255)
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

    @model_validator(mode="after")
    def validate_rules(self):
        if self.type.value == 'percentage' and self.value > 100:
            raise ValueError('Percentage discounts cannot exceed 100%')
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError('End date must be after start date')
        if self.applies_to.value == 'product' and not self.product_id:
            raise ValueError('Select a product for a product discount')
        return self


class DiscountCreate(DiscountBase):
    pass


class DiscountUpdate(ValidatedModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
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
class TaxRuleBase(ValidatedModel):
    name: str = Field(min_length=2, max_length=255)
    rate: float = Field(ge=0.0, le=100.0)  # Percentage rate
    description: Optional[str] = None
    is_active: bool = True


class TaxRuleCreate(TaxRuleBase):
    pass


class TaxRuleUpdate(ValidatedModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    rate: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TaxRuleResponse(TaxRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Activity Log Schema
class ActivityLogResponse(ValidatedModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
