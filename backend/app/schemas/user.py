from datetime import datetime
from typing import Optional
from pydantic import Field, BaseModel, EmailStr, ConfigDict, field_validator

from app.schemas.base import ValidatedModel

from app.models.user import UserRole
from app.utils.security import validate_password_strength


class UserBase(ValidatedModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        if not validate_password_strength(v):
            raise ValueError(
                "Password must be more than 8 characters long, include an uppercase letter, "
                "a lowercase letter, and a special character (!@#$%^&*()_+-=[]{}|;:,.<>?)."
            )
        return v


class StaffCreate(UserCreate):
    role: UserRole = UserRole.staff


class UserUpdate(ValidatedModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None


class UserPasswordUpdate(ValidatedModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        if not validate_password_strength(v):
            raise ValueError(
                "Password must be more than 8 characters long, include an uppercase letter, "
                "a lowercase letter, and a special character."
            )
        return v


class UserResponse(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserLogin(ValidatedModel):
    email: EmailStr
    password: str


class Token(ValidatedModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(ValidatedModel):
    sub: Optional[str] = None
    exp: Optional[int] = None


class PasswordResetRequest(ValidatedModel):
    email: EmailStr


class PasswordResetConfirm(ValidatedModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, v: str) -> str:
        if not validate_password_strength(v):
            raise ValueError(
                "Password must be more than 8 characters long, include an uppercase letter, "
                "a lowercase letter, and a special character."
            )
        return v
