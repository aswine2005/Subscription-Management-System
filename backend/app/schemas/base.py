from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, ValidationInfo, field_validator, field_serializer


class ValidatedModel(BaseModel):
    """Finite financial values, preserved credentials, and UTC API timestamps."""
    model_config = ConfigDict(allow_inf_nan=False)

    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value: Any, info: ValidationInfo):
        if isinstance(value, str) and info.field_name not in {"password", "new_password", "current_password"}:
            return value.strip()
        return value

    @field_validator("*", mode="after")
    @classmethod
    def normalize_utc(cls, value: Any):
        if isinstance(value, datetime) and value.tzinfo:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    @field_serializer("*", when_used="json", check_fields=False)
    def serialize_dates(self, value: Any):
        if isinstance(value, datetime):
            return value.isoformat(timespec="milliseconds") + "Z"
        return value


class CurrencyModel(ValidatedModel):
    """All monetary values in this workspace are INR. No implicit FX conversion."""
    currency: Literal["INR"] = "INR"
