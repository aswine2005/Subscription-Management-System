from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import ValidatedModel, CurrencyModel

from app.models.product import ProductType


# Product Variant Schemas
class ProductVariantBase(CurrencyModel):
    name: str = Field(min_length=2, max_length=255)
    additional_price: float = Field(default=0.0, ge=0.0)
    is_active: bool = True


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantUpdate(ValidatedModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    additional_price: Optional[float] = Field(default=None, ge=0.0)
    is_active: Optional[bool] = None


class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Product Schemas
class ProductBase(CurrencyModel):
    name: str = Field(min_length=2, max_length=255)
    type: ProductType
    sales_price: float = Field(default=0.0, ge=0.0)
    cost_price: float = Field(default=0.0, ge=0.0)
    description: Optional[str] = None
    is_active: bool = True


class ProductCreate(ProductBase):
    variants: Optional[List[ProductVariantCreate]] = None


class ProductUpdate(ValidatedModel):
    variants: Optional[List[ProductVariantCreate]] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    type: Optional[ProductType] = None
    sales_price: Optional[float] = Field(default=None, ge=0.0)
    cost_price: Optional[float] = Field(default=None, ge=0.0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    variants: List[ProductVariantResponse] = []

    model_config = ConfigDict(from_attributes=True)
