from datetime import datetime
from typing import Optional
from pydantic import model_validator, BaseModel, ConfigDict, Field

from app.schemas.base import ValidatedModel, CurrencyModel

from app.models.plan import BillingCycle
from app.schemas.product import ProductResponse


class PlanBase(CurrencyModel):
    name: str = Field(min_length=2, max_length=255)
    product_id: int
    billing_cycle: BillingCycle
    price: float = Field(default=0.0, ge=0.0)
    min_quantity: int = Field(default=1, ge=1)
    available_from: datetime = Field(default_factory=datetime.utcnow)
    available_to: Optional[datetime] = None
    auto_close: bool = False
    allow_early_close: bool = True
    allow_pause: bool = True
    allow_renewal: bool = True
    is_active: bool = True

    @model_validator(mode="after")
    def validate_rules(self):
        if self.available_to and self.available_to <= self.available_from:
            raise ValueError('Availability end must be after availability start')
        return self


class PlanCreate(PlanBase):
    pass


class PlanUpdate(ValidatedModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    product_id: Optional[int] = None
    billing_cycle: Optional[BillingCycle] = None
    price: Optional[float] = Field(default=None, ge=0.0)
    min_quantity: Optional[int] = Field(default=None, ge=1)
    available_from: Optional[datetime] = None
    available_to: Optional[datetime] = None
    auto_close: Optional[bool] = None
    allow_early_close: Optional[bool] = None
    allow_pause: Optional[bool] = None
    allow_renewal: Optional[bool] = None
    is_active: Optional[bool] = None


class PlanResponse(PlanBase):
    id: int
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)
