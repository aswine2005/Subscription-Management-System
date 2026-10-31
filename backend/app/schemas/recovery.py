from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import Field, field_validator, model_validator
from app.schemas.base import ValidatedModel


class RecoveryParameters(ValidatedModel):
    max_accounts: int = Field(default=3, ge=0, le=50)
    collection_rate: float = Field(default=50, ge=0, le=100)
    min_days_overdue: int = Field(default=1, ge=1, le=365)


class SaveRecoveryPlan(RecoveryParameters):
    title: str = Field(default="My recovery plan", min_length=2, max_length=120)


class CollectionCaseUpdate(ValidatedModel):
    status: Literal["open", "contacted", "promised", "disputed"]
    note: str = Field(default="", max_length=1500)
    promised_amount: Optional[float] = Field(default=None, ge=0.01)
    promise_date: Optional[date] = None

    @field_validator("promised_amount")
    @classmethod
    def whole_paise(cls, value):
        if value is not None and Decimal(str(value)) != Decimal(str(value)).quantize(Decimal("0.01")):
            raise ValueError("Promise amounts must use whole paise")
        return value

    @model_validator(mode="after")
    def promise_details(self):
        if self.status == "promised" and (self.promised_amount is None or self.promise_date is None):
            raise ValueError("A payment promise needs an amount and a date")
        if self.status == "disputed" and len(self.note) < 5:
            raise ValueError("Add a short note explaining the dispute")
        return self
