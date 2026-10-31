import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.database import Base


class BillingCycle(str, enum.Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    billing_cycle = Column(SQLEnum(BillingCycle), nullable=False, index=True)
    price = Column(Float, nullable=False, default=0.0)
    min_quantity = Column(Integer, default=1, nullable=False)
    available_from = Column(DateTime, default=datetime.utcnow, nullable=False)
    available_to = Column(DateTime, nullable=True)
    auto_close = Column(Boolean, default=False, nullable=False)
    allow_early_close = Column(Boolean, default=True, nullable=False)
    allow_pause = Column(Boolean, default=True, nullable=False)
    allow_renewal = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    product = relationship("Product", back_populates="plans")
    subscriptions = relationship("Subscription", back_populates="plan", lazy="select")
    quotation_templates = relationship("QuotationTemplate", back_populates="plan", lazy="select")

    def __repr__(self):
        return f"<Plan id={self.id} name={self.name} cycle={self.billing_cycle} price={self.price}>"
