from fastapi import APIRouter
from app.routes.auth import router as auth_router
from app.routes.users import router as users_router
from app.routes.products import router as products_router
from app.routes.plans import router as plans_router
from app.routes.subscriptions import router as subscriptions_router
from app.routes.invoices import router as invoices_router
from app.routes.payments import router as payments_router
from app.routes.discounts import router as discounts_router
from app.routes.dashboard import router as dashboard_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(products_router)
api_router.include_router(plans_router)
api_router.include_router(subscriptions_router)
api_router.include_router(invoices_router)
api_router.include_router(payments_router)
api_router.include_router(discounts_router)
api_router.include_router(dashboard_router)

__all__ = ["api_router"]
