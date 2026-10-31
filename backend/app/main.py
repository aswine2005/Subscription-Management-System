from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime
from app.database import SessionLocal
from app.models.subscription import Subscription, SubscriptionStatus
from app.services.billing_service import generate_bulk_invoices
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from app.database import get_db
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.utils.money import CURRENCY_CODE
from app.database import engine, Base
import app.models  # Ensure all models are registered with Base.metadata
from app.routes import api_router


def billing_tick():
    with SessionLocal() as db:
        now = datetime.utcnow()
        for sub in db.query(Subscription).filter(Subscription.status.in_([SubscriptionStatus.active, SubscriptionStatus.paused])).all():
            if sub.plan.auto_close and sub.expiry_date and sub.expiry_date <= now:
                sub.status = SubscriptionStatus.closed
        db.commit()
        count, _, _ = generate_bulk_invoices(db) if settings.AUTO_BILLING else (0, 0, [])
        if count:
            from app.dependencies import log_activity
            log_activity(db, "scheduled_billing", "billing", details=f"Local scheduler generated {count} invoices")

async def billing_worker():
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(billing_tick)
        except Exception:
            logging.getLogger("brightloop.billing").exception("Scheduled billing failed")

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.migrations import ensure_schema
    ensure_schema()
    task = asyncio.create_task(billing_worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Local-first subscription operations and recurring billing.",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include master API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
def root_status():
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "healthy",
        "api_docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    return {
        "status": "ok",
        "currency": CURRENCY_CODE,
        "database": "connected",
        "version": settings.VERSION,
    }
