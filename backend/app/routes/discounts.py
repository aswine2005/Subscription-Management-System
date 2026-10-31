from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.discount import Discount, TaxRule, DiscountAppliesTo
from app.models.product import Product
from app.utils.money import format_inr
from app.models.user import User
from app.schemas.discount import (
    DiscountCreate,
    DiscountUpdate,
    DiscountResponse,
    TaxRuleCreate,
    TaxRuleUpdate,
    TaxRuleResponse,
)
from app.dependencies import (
    get_current_active_user,
    require_admin,
    require_staff_or_admin,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/discounts", tags=["Discounts & Tax Rules"])


def validate_discount_product(db, rule):
    if rule.applies_to == DiscountAppliesTo.product:
        product = db.get(Product, rule.product_id)
        if not product or not product.is_active:
            raise HTTPException(status_code=400, detail="Select an available product for this discount.")



# --- Tax Rules Endpoints (placed before dynamic /{id} routes) ---
@router.get("/tax-rules", response_model=List[TaxRuleResponse])
def list_tax_rules(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List system tax rules."""
    query = db.query(TaxRule)
    if is_active is not None:
        query = query.filter(TaxRule.is_active == is_active)
    return query.order_by(TaxRule.id.asc()).all()


@router.post("/tax-rules", response_model=TaxRuleResponse, status_code=status.HTTP_201_CREATED)
def create_tax_rule(
    rule_in: TaxRuleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new tax rule (admin only)."""
    rule = TaxRule(
        name=rule_in.name.strip(),
        rate=rule_in.rate,
        description=rule_in.description.strip() if rule_in.description else None,
        is_active=rule_in.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    log_activity(
        db,
        action="tax_rule_created",
        entity_type="tax_rule",
        entity_id=rule.id,
        user_id=admin.id,
        details=f"Admin created tax rule: {rule.name} ({rule.rate}%)"
    )
    return rule


@router.get("/tax-rules/{rule_id}", response_model=TaxRuleResponse)
def get_tax_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single tax rule by id."""
    rule = db.query(TaxRule).filter(TaxRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rule not found")
    return rule


@router.put("/tax-rules/{rule_id}", response_model=TaxRuleResponse)
def update_tax_rule(
    rule_id: int,
    rule_update: TaxRuleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update tax rule configuration (admin only)."""
    rule = db.query(TaxRule).filter(TaxRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rule not found")

    if rule_update.name is not None:
        rule.name = rule_update.name.strip()
    if rule_update.rate is not None:
        rule.rate = rule_update.rate
    if rule_update.description is not None:
        rule.description = rule_update.description.strip() if rule_update.description else None
    if rule_update.is_active is not None:
        rule.is_active = rule_update.is_active

    db.commit()
    db.refresh(rule)
    log_activity(
        db,
        action="tax_rule_updated",
        entity_type="tax_rule",
        entity_id=rule.id,
        user_id=admin.id,
        details=f"Admin updated tax rule {rule.name}"
    )
    return rule


@router.delete("/tax-rules/{rule_id}", status_code=status.HTTP_200_OK)
def delete_tax_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate a tax rule (admin only)."""
    rule = db.query(TaxRule).filter(TaxRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax rule not found")

    rule.is_active = False
    db.commit()
    return {"message": f"Tax rule '{rule.name}' deactivated."}


# --- Discounts Endpoints ---
@router.get("/", response_model=List[DiscountResponse])
def list_discounts(
    is_active: Optional[bool] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """List discount campaigns and coupon rules (staff and admin only)."""
    query = db.query(Discount)
    if is_active is not None:
        query = query.filter(Discount.is_active == is_active)

    return (
        query.order_by(Discount.id.desc())
        .offset(pagination.skip)
        .limit(pagination.limit)
        .all()
    )


@router.post("/", response_model=DiscountResponse, status_code=status.HTTP_201_CREATED)
def create_discount(
    discount_in: DiscountCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a new discount rule (admin only)."""
    if discount_in.code:
        existing = db.query(Discount).filter(Discount.code == discount_in.code.strip().upper()).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount code already exists")

    validate_discount_product(db, discount_in)
    discount = Discount(
        name=discount_in.name.strip(),
        code=discount_in.code.strip().upper() if discount_in.code else None,
        type=discount_in.type,
        value=discount_in.value,
        min_purchase_amount=discount_in.min_purchase_amount,
        min_quantity=discount_in.min_quantity,
        start_date=discount_in.start_date,
        end_date=discount_in.end_date,
        max_uses=discount_in.max_uses,
        current_uses=0,
        applies_to=discount_in.applies_to,
        product_id=discount_in.product_id,
        is_active=discount_in.is_active,
    )
    db.add(discount)
    db.commit()
    db.refresh(discount)
    log_activity(
        db,
        action="discount_created",
        entity_type="discount",
        entity_id=discount.id,
        user_id=admin.id,
        details=f"Admin created discount: {discount.name} ({format_inr(discount.value) if discount.type.value == 'fixed' else str(discount.value) + '%'})"
    )
    return discount


@router.get("/{discount_id}", response_model=DiscountResponse)
def get_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    staff_user: User = Depends(require_staff_or_admin),
):
    """Get single discount rule details."""
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")
    return discount


@router.put("/{discount_id}", response_model=DiscountResponse)
def update_discount(
    discount_id: int,
    discount_update: DiscountUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update discount rule details (admin only)."""
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")

    from app.schemas.discount import DiscountBase
    from pydantic import ValidationError
    merged = {key: getattr(discount, key, field.default) for key, field in DiscountBase.model_fields.items()}
    merged.update(discount_update.model_dump(exclude_unset=True))
    try:
        combined = DiscountBase.model_validate(merged)
        validate_discount_product(db, combined)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if discount_update.name is not None:
        discount.name = discount_update.name.strip()
    if discount_update.code is not None:
        existing = db.query(Discount).filter(Discount.code == discount_update.code.upper(), Discount.id != discount.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Discount code already exists")
        discount.code = discount_update.code.strip().upper()
    if discount_update.type is not None:
        discount.type = discount_update.type
    if discount_update.value is not None:
        discount.value = discount_update.value
    if discount_update.min_purchase_amount is not None:
        discount.min_purchase_amount = discount_update.min_purchase_amount
    if discount_update.min_quantity is not None:
        discount.min_quantity = discount_update.min_quantity
    if discount_update.start_date is not None:
        discount.start_date = discount_update.start_date
    if "end_date" in discount_update.model_fields_set:
        discount.end_date = discount_update.end_date
    if "max_uses" in discount_update.model_fields_set:
        discount.max_uses = discount_update.max_uses
    if discount_update.applies_to is not None:
        discount.applies_to = discount_update.applies_to
    if discount_update.product_id is not None:
        discount.product_id = discount_update.product_id
    if discount_update.is_active is not None:
        discount.is_active = discount_update.is_active

    db.commit()
    db.refresh(discount)
    log_activity(
        db,
        action="discount_updated",
        entity_type="discount",
        entity_id=discount.id,
        user_id=admin.id,
        details=f"Admin updated discount {discount.name}"
    )
    return discount


@router.delete("/{discount_id}", status_code=status.HTTP_200_OK)
def deactivate_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Deactivate a discount rule (admin only)."""
    discount = db.query(Discount).filter(Discount.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount not found")

    discount.is_active = False
    db.commit()
    return {"message": f"Discount '{discount.name}' deactivated."}
