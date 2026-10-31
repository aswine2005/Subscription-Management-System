from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.utils.security import (
    verify_password,
    get_password_hash,
    generate_reset_token,
)
from app.utils.email import send_password_reset_email


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email.strip().lower()).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def create_user(
    db: Session,
    user_in: UserCreate,
    role: UserRole = UserRole.customer
) -> User:
    clean_email = user_in.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{clean_email}' already exists."
        )

    hashed_pw = get_password_hash(user_in.password)
    db_user = User(
        email=clean_email,
        hashed_password=hashed_pw,
        full_name=user_in.full_name.strip(),
        company_name=user_in.company_name.strip() if user_in.company_name else None,
        phone=user_in.phone.strip() if user_in.phone else None,
        role=role,
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def request_password_reset(db: Session, email: str) -> str:
    clean_email = email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        # Avoid user enumeration in public API by returning a generic token representation
        # but don't error out; simulate success
        return ""

    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    db.commit()

    send_password_reset_email(to_email=user.email, reset_token=token, full_name=user.full_name)
    return token


def reset_password_with_token(db: Session, token: str, new_password: str) -> User:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    user = db.query(User).filter(
        User.reset_token == token,
        User.reset_token_expires_at > now
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token."
        )

    user.hashed_password = get_password_hash(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    db.refresh(user)
    return user
