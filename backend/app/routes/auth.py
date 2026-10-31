from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin,
    Token,
    PasswordResetRequest,
    PasswordResetConfirm,
)
from app.services.auth_service import (
    authenticate_user,
    create_user,
    request_password_reset,
    reset_password_with_token,
)
from app.utils.security import create_access_token
from app.dependencies import get_current_active_user, log_activity

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_customer(user_in: UserCreate, db: Session = Depends(get_db)):
    """Customer self-registration endpoint."""
    user = create_user(db, user_in, role=UserRole.customer)
    log_activity(
        db,
        action="user_registered",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details=f"Customer registered: {user.email}"
    )
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login endpoint supporting both JSON payload and standard OAuth2 form-encoded data.
    """
    email: Optional[str] = None
    password: Optional[str] = None

    # Check content type
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing email/username or password"
        )

    from pydantic import ValidationError
    try:
        credentials = UserLogin.model_validate({"email": email, "password": password})
    except ValidationError:
        raise HTTPException(status_code=422, detail="Enter a valid email address and password.")
    user = authenticate_user(db, email=credentials.email, password=credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )

    access_token = create_access_token(subject=user.id)
    log_activity(
        db,
        action="user_logged_in",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details=f"User logged in: {user.email} ({user.role.value})"
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve profile of currently authenticated user."""
    return current_user


@router.post("/forgot-password")
def forgot_password(
    data: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    """Initiate password reset flow, generating token and simulating email delivery."""
    request_password_reset(db, data.email)
    return {
        "message": "If the account exists, reset instructions were sent. In local mode, find the email in backend/outbox."
    }


@router.post("/reset-password")
def reset_password(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using verified security token."""
    user = reset_password_with_token(db, data.token, data.new_password)
    log_activity(
        db,
        action="password_reset_completed",
        entity_type="user",
        entity_id=user.id,
        user_id=user.id,
        details=f"Password successfully reset for {user.email}"
    )
    return {
        "message": "Password has been successfully updated. You may now log in."
    }
