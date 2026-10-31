from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.product import Product, ProductVariant, ProductType
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductVariantCreate,
    ProductVariantUpdate,
    ProductVariantResponse,
)
from app.dependencies import (
    get_current_active_user,
    require_admin,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/", response_model=List[ProductResponse])
def list_products(
    type: Optional[ProductType] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List products with filters for type, active status, search and pagination."""
    query = db.query(Product)
    if type:
        query = query.filter(Product.type == type)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(s),
                Product.description.ilike(s)
            )
        )
    return query.order_by(Product.name.asc()).offset(pagination.skip).limit(pagination.limit).all()


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new product with optional initial variants (admin only)."""
    product = Product(
        name=product_in.name.strip(),
        type=product_in.type,
        sales_price=product_in.sales_price,
        cost_price=product_in.cost_price,
        description=product_in.description.strip() if product_in.description else None,
        is_active=product_in.is_active,
    )
    db.add(product)
    db.flush()

    if product_in.variants:
        for v in product_in.variants:
            variant = ProductVariant(
                product_id=product.id,
                name=v.name.strip(),
                additional_price=v.additional_price,
                is_active=v.is_active,
            )
            db.add(variant)

    db.commit()
    db.refresh(product)
    log_activity(
        db,
        action="product_created",
        entity_type="product",
        entity_id=product.id,
        user_id=admin.id,
        details=f"Admin created product: {product.name} ({product.type.value})"
    )
    return product


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single product with all associated variants."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update product information (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if product_update.name is not None:
        product.name = product_update.name.strip()
    if product_update.type is not None:
        product.type = product_update.type
    if product_update.sales_price is not None:
        product.sales_price = product_update.sales_price
    if product_update.cost_price is not None:
        product.cost_price = product_update.cost_price
    if product_update.description is not None:
        product.description = product_update.description.strip() if product_update.description else None
    if product_update.is_active is not None:
        product.is_active = product_update.is_active

    db.commit()
    db.refresh(product)
    log_activity(
        db,
        action="product_updated",
        entity_type="product",
        entity_id=product.id,
        user_id=admin.id,
        details=f"Admin updated product {product.name}"
    )
    return product


@router.delete("/{product_id}", status_code=status.HTTP_200_OK)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate or remove a product (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.is_active = False
    db.commit()
    log_activity(
        db,
        action="product_deactivated",
        entity_type="product",
        entity_id=product.id,
        user_id=admin.id,
        details=f"Admin deactivated product: {product.name}"
    )
    return {"message": f"Product '{product.name}' deactivated."}


# Product Variant Endpoints
@router.post("/{product_id}/variants", response_model=ProductVariantResponse, status_code=status.HTTP_201_CREATED)
def add_product_variant(
    product_id: int,
    variant_in: ProductVariantCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Add a variant to a product (admin only)."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    variant = ProductVariant(
        product_id=product.id,
        name=variant_in.name.strip(),
        additional_price=variant_in.additional_price,
        is_active=variant_in.is_active,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


@router.put("/{product_id}/variants/{variant_id}", response_model=ProductVariantResponse)
def update_product_variant(
    product_id: int,
    variant_id: int,
    variant_update: ProductVariantUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update a product variant (admin only)."""
    variant = db.query(ProductVariant).filter(
        ProductVariant.id == variant_id,
        ProductVariant.product_id == product_id
    ).first()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product variant not found")

    if variant_update.name is not None:
        variant.name = variant_update.name.strip()
    if variant_update.additional_price is not None:
        variant.additional_price = variant_update.additional_price
    if variant_update.is_active is not None:
        variant.is_active = variant_update.is_active

    db.commit()
    db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_200_OK)
def delete_product_variant(
    product_id: int,
    variant_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate or delete a product variant (admin only)."""
    variant = db.query(ProductVariant).filter(
        ProductVariant.id == variant_id,
        ProductVariant.product_id == product_id
    ).first()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product variant not found")

    variant.is_active = False
    db.commit()
    return {"message": f"Variant '{variant.name}' deactivated."}
