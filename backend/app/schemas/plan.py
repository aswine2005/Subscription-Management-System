from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.plan import BillingCycle
from app.schemas.product import ProductResponse


class PlanBase(BaseModel):
    name: str
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


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = None
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
