import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.dependencies import require_staff_or_admin, log_activity
from app.models.invoice import Invoice, InvoiceStatus
from app.models.recovery import CollectionCase, RecoveryPlan
from app.models.user import User
from app.schemas.recovery import RecoveryParameters, SaveRecoveryPlan, CollectionCaseUpdate
from app.services.billing_service import get_invoice_balance
from app.services.recovery_service import analyze_recovery, simulate_recovery, reminder_draft
from app.utils.money import format_inr

router = APIRouter(prefix="/recovery", tags=["Revenue Recovery Lab"])


@router.get("/overview")
def overview(min_days_overdue: int = Query(default=1, ge=1, le=365), db: Session = Depends(get_db), user: User = Depends(require_staff_or_admin)):
    return analyze_recovery(db, min_days_overdue)


@router.post("/simulate")
def simulate(parameters: RecoveryParameters, db: Session = Depends(get_db), user: User = Depends(require_staff_or_admin)):
    return simulate_recovery(db, parameters)


def plan_response(plan):
    return {"id": plan.id, "title": plan.title, "created_at": plan.created_at.isoformat() + "Z",
            "created_by": plan.creator.full_name, "snapshot": json.loads(plan.snapshot)}


@router.get("/plans")
def plans(db: Session = Depends(get_db), user: User = Depends(require_staff_or_admin)):
    records = db.query(RecoveryPlan).options(selectinload(RecoveryPlan.creator)).order_by(RecoveryPlan.id.desc()).limit(10).all()
    return [plan_response(plan) for plan in records]


@router.post("/plans", status_code=201)
def save_plan(payload: SaveRecoveryPlan, db: Session = Depends(get_db), user: User = Depends(require_staff_or_admin)):
    parameters = RecoveryParameters.model_validate(payload.model_dump())
    snapshot = simulate_recovery(db, parameters)
    if not snapshot["targets"]:
        raise HTTPException(status_code=400, detail="There are no eligible accounts to include in this plan.")
    plan = RecoveryPlan(title=payload.title, created_by=user.id, snapshot=json.dumps(snapshot))
    db.add(plan)
    db.commit()
    db.refresh(plan)
    log_activity(db, "recovery_plan_saved", "recovery_plan", plan.id, user.id, f"Saved a scenario for {snapshot['target_count']} accounts: {format_inr(snapshot['modeled_collection'])} modeled, no payments recorded.")
    return plan_response(plan)


@router.put("/cases/{invoice_id}")
def update_case(invoice_id: int, payload: CollectionCaseUpdate, db: Session = Depends(get_db), user: User = Depends(require_staff_or_admin)):
    from app.services.locking import lock_write
    lock_write(db)
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    _, balance = get_invoice_balance(db, invoice.id)
    if invoice.status not in [InvoiceStatus.confirmed, InvoiceStatus.overdue] or balance <= 0:
        raise HTTPException(status_code=400, detail="Collection actions require an issued invoice with an outstanding balance.")
    now = datetime.utcnow()
    if payload.status == "promised":
        if payload.promise_date < now.date():
            raise HTTPException(status_code=400, detail="Choose today or a future date for a new payment promise.")
        if payload.promised_amount > balance:
            raise HTTPException(status_code=400, detail=f"A promise cannot exceed the remaining balance of {format_inr(balance)}.")
    case = db.query(CollectionCase).filter(CollectionCase.invoice_id == invoice.id).first()
    if not case:
        case = CollectionCase(invoice_id=invoice.id, owner_id=user.id)
        db.add(case)
    case.owner_id = user.id
    case.status = payload.status
    case.note = payload.note
    case.updated_at = now
    if payload.status == "promised":
        case.promised_amount = payload.promised_amount
        case.promise_date = payload.promise_date
        case.promise_recorded_at = now
    else:
        case.promised_amount = None
        case.promise_date = None
        case.promise_recorded_at = None
    if payload.status == "contacted":
        case.last_contact_at = now
    db.commit()
    log_activity(db, "collection_action_logged", "invoice", invoice.id, user.id, f"{invoice.invoice_number}: {payload.status}. {payload.note}")
    return {"message": "Collection action saved.", "invoice_id": invoice.id, "status": case.status}


@router.get("/drafts/{invoice_id}")
def draft(invoice_id: int, db: Session = Depends(get_db), user: User = Depends(require_staff_or_admin)):
    analysis = analyze_recovery(db)
    for account in analysis["accounts"]:
        for invoice in account["invoices"]:
            if invoice["invoice_id"] == invoice_id:
                return {"subject": f"Following up on {invoice['invoice_number']}", "body": reminder_draft(account, invoice), "delivery": "draft_only"}
    raise HTTPException(status_code=404, detail="An overdue issued invoice with an outstanding balance is required.")
