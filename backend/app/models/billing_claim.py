from sqlalchemy import Column, String, Integer, ForeignKey
from app.database import Base
class BillingClaim(Base):
    __tablename__ = "billing_claims"
    key = Column(String(150), primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
