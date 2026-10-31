from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, StaffCreate, UserUpdate
from app.services.auth_service import create_user
from app.dependencies import (
    get_current_active_user,
    require_admin,
    require_staff_or_admin,
    PaginationParams,
    log_activity,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/", response_model=List[UserResponse])
def list_users(
    role: Optional[UserRole] = None,
    search: Optional[str] = None,
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """List users with pagination, role filter, and text search (staff and admin only)."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(s),
                User.email.ilike(s),
                User.company_name.ilike(s)
            )
        )
    users = query.order_by(User.id.desc()).offset(pagination.skip).limit(pagination.limit).all()
    return users


@router.post("/staff", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_staff_user(
    staff_in: StaffCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin endpoint to provision new staff accounts."""
    user = create_user(db, staff_in, role=UserRole.staff)
    log_activity(
        db,
        action="staff_account_created",
        entity_type="user",
        entity_id=user.id,
        user_id=admin.id,
        details=f"Admin {admin.email} created staff account {user.email}"
    )
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get single user profile (accessible by staff/admin or self)."""
    if current_user.role == UserRole.customer and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user_profile(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update user information."""
    # Permissions check
    if current_user.role == UserRole.customer and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_update.full_name is not None:
        user.full_name = user_update.full_name.strip()
    if user_update.company_name is not None:
        user.company_name = user_update.company_name.strip() if user_update.company_name else None
    if user_update.phone is not None:
        user.phone = user_update.phone.strip() if user_update.phone else None

    # Role and is_active can only be updated by admin
    if user_update.role is not None:
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can alter user roles")
        user.role = user_update.role

    if user_update.is_active is not None:
        if current_user.role != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can alter account activation")
        user.is_active = user_update.is_active

    db.commit()
    db.refresh(user)
    log_activity(
        db,
        action="user_profile_updated",
        entity_type="user",
        entity_id=user.id,
        user_id=current_user.id,
        details=f"User {user.email} updated by {current_user.email}"
    )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin endpoint to deactivate an account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot deactivate own account")

    user.is_active = False
    db.commit()
    log_activity(
        db,
        action="user_deactivated",
        entity_type="user",
        entity_id=user.id,
        user_id=admin.id,
        details=f"Admin deactivated user {user.email}"
    )
    return {"message": f"User {user.email} successfully deactivated."}
