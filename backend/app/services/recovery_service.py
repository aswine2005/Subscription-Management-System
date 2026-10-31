"""Explainable collection priorities and what-if analysis, computed from the ledger.

Priority is an operational sorting rule, never a probability of payment. The
simulator does not mutate invoices, collect money, or contact customers.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import selectinload
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import PaymentStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.plan import BillingCycle
from app.models.recovery import CollectionCase
from app.utils.money import format_inr


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def amount(value):
    return float(money(value))


def iso(value):
    if value is None:
        return None
    return value.isoformat() + ("Z" if isinstance(value, datetime) else "")


def monthly_value(subscription):
    factors = {BillingCycle.daily: Decimal("365.25") / 12, BillingCycle.weekly: Decimal(52) / 12,
               BillingCycle.monthly: Decimal(1), BillingCycle.yearly: Decimal(1) / 12}
    return sum((money(line.subtotal) for line in subscription.lines), Decimal(0)) * factors[subscription.plan.billing_cycle]


def analyze_recovery(db, min_days_overdue=1, now=None):
    now = now or datetime.utcnow()
    invoices = db.query(Invoice).options(selectinload(Invoice.payments), selectinload(Invoice.customer)).filter(
        Invoice.status.in_([InvoiceStatus.confirmed, InvoiceStatus.overdue])
    ).all()
    cases = {case.invoice_id: case for case in db.query(CollectionCase).options(selectinload(CollectionCase.owner)).all()}
    accounts = {}
    outstanding = Decimal(0)
    overdue_total = Decimal(0)
    upcoming_seven = Decimal(0)
    promises_total = Decimal(0)
    broken_count = 0
    active_promise_count = 0
    invoice_count = 0
    aging = {"0–7 days": Decimal(0), "8–30 days": Decimal(0), "31–60 days": Decimal(0), "60+ days": Decimal(0)}
    for invoice in invoices:
        completed = [p for p in invoice.payments if p.status == PaymentStatus.completed]
        paid = sum((money(p.amount) for p in completed), Decimal(0))
        balance = max(Decimal(0), money(invoice.total) - paid)
        if balance <= 0:
            continue
        outstanding += balance
        if invoice.due_date >= now:
            if invoice.due_date <= now + timedelta(days=7):
                upcoming_seven += balance
            continue
        overdue_total += balance
        invoice_count += 1
        days = max(0, (now - invoice.due_date).days)
        bucket = "0–7 days" if days <= 7 else "8–30 days" if days <= 30 else "31–60 days" if days <= 60 else "60+ days"
        aging[bucket] += balance
        case = cases.get(invoice.id)
        case_status = case.status if case else "open"
        paid_since_promise = sum((money(p.amount) for p in completed if case and case.promise_recorded_at and p.created_at >= case.promise_recorded_at), Decimal(0))
        remaining_promise = max(Decimal(0), money(case.promised_amount or 0) - paid_since_promise) if case else Decimal(0)
        promise_state = None
        if case_status == "promised":
            if remaining_promise <= 0:
                promise_state = "fulfilled"
            elif case.promise_date and case.promise_date < now.date():
                promise_state = "missed"
                broken_count += 1
            else:
                promise_state = "on_track"
                active_promise_count += 1
                if case.promise_date and case.promise_date <= (now + timedelta(days=14)).date():
                    promises_total += min(balance, remaining_promise)
        recently_contacted = bool(case_status == "contacted" and case.last_contact_at and case.last_contact_at >= now - timedelta(days=2))
        hold = "Resolve dispute first" if case_status == "disputed" else "Payment promised" if promise_state == "on_track" else "Awaiting reply · 2-day cooldown" if recently_contacted else None
        eligible = days >= min_days_overdue and hold is None
        context = {
            "status": case_status, "note": case.note if case else "", "owner_name": case.owner.full_name if case and case.owner else None,
            "promised_amount": case.promised_amount if case else None, "promise_date": iso(case.promise_date) if case else None,
            "promise_state": promise_state, "remaining_promise": amount(min(balance, remaining_promise)),
            "updated_at": iso(case.updated_at) if case else None,
        }
        row = {
            "invoice_id": invoice.id, "invoice_number": invoice.invoice_number, "due_date": iso(invoice.due_date),
            "balance": amount(balance), "amount_paid": amount(paid), "days_overdue": days, "eligible": eligible,
            "hold_reason": hold or (f"Less than {min_days_overdue} days overdue" if not eligible else None), "case": context,
        }
        if invoice.customer_id not in accounts:
            accounts[invoice.customer_id] = {"customer_id": invoice.customer_id, "customer_name": invoice.customer.full_name,
                "company_name": invoice.customer.company_name, "email": invoice.customer.email, "invoices": [],
                "overdue_balance": Decimal(0), "eligible_balance": Decimal(0), "max_days_overdue": 0,
                "amount_paid": Decimal(0), "broken_promises": 0, "disputed_invoices": 0, "active_promises": 0, "mrr_exposed": Decimal(0)}
        account = accounts[invoice.customer_id]
        account["invoices"].append(row)
        account["overdue_balance"] += balance
        account["eligible_balance"] += balance if eligible else 0
        account["max_days_overdue"] = max(account["max_days_overdue"], days)
        account["amount_paid"] += paid
        account["broken_promises"] += int(promise_state == "missed")
        account["disputed_invoices"] += int(case_status == "disputed")
        account["active_promises"] += int(promise_state == "on_track")
    subscriptions = db.query(Subscription).options(selectinload(Subscription.lines), selectinload(Subscription.plan)).filter(Subscription.status == SubscriptionStatus.active).all()
    for sub in subscriptions:
        if sub.customer_id in accounts:
            accounts[sub.customer_id]["mrr_exposed"] += monthly_value(sub)
    largest = max((a["overdue_balance"] for a in accounts.values()), default=Decimal(1)) or Decimal(1)
    results = []
    for account in accounts.values():
        age_points = round(min(account["max_days_overdue"], 90) / 90 * 60)
        balance_points = round(float(account["overdue_balance"] / largest) * 30)
        promise_points = 10 if account["broken_promises"] else 0
        account["priority_score"] = min(100, age_points + balance_points + promise_points)
        account["score_breakdown"] = {"age": age_points, "balance": balance_points, "missed_promise": promise_points}
        reasons = [f"Oldest invoice: {account['max_days_overdue']} days overdue.", f"{format_inr(account['overdue_balance'])} across {len(account['invoices'])} overdue invoice(s)."]
        if account["amount_paid"] > 0:
            reasons.append(f"{format_inr(account['amount_paid'])} already received against these invoices.")
        if account["broken_promises"]:
            reasons.append(f"{account['broken_promises']} payment promise(s) missed.")
        account["reasons"] = reasons
        account["recommended_action"] = "Resolve the disputed invoice" if account["disputed_invoices"] else "Reschedule the missed promise" if account["broken_promises"] else "Follow up on the remaining balance" if account["amount_paid"] else "Prepare a clear payment reminder"
        if account["eligible_balance"] == 0:
            account["recommended_action"] = "Monitor the existing commitment" if account["active_promises"] else "Review the account's collection hold"
        account["invoices"].sort(key=lambda i: (-i["days_overdue"], -i["balance"], i["invoice_id"]))
        for key in ["overdue_balance", "eligible_balance", "amount_paid", "mrr_exposed"]:
            account[key] = amount(account[key])
        results.append(account)
    results.sort(key=lambda a: (-a["priority_score"], -a["eligible_balance"], a["customer_id"]))
    return {
        "currency": "INR", "generated_at": iso(now), "min_days_overdue": min_days_overdue,
        "summary": {"outstanding_balance": amount(outstanding), "overdue_balance": amount(overdue_total),
            "overdue_invoice_count": invoice_count, "overdue_account_count": len(results),
            "eligible_balance": amount(sum((money(a["eligible_balance"]) for a in results), Decimal(0))),
            "eligible_account_count": sum(a["eligible_balance"] > 0 for a in results),
            "mrr_exposed": amount(sum((money(a["mrr_exposed"]) for a in results), Decimal(0))),
            "due_next_seven_days": amount(upcoming_seven), "promised_next_fourteen_days": amount(promises_total),
            "active_promises": active_promise_count, "broken_promises": broken_count,
            "overdue_share": round(float(overdue_total / outstanding * 100), 1) if outstanding else 0},
        "aging": [{"label": label, "amount": amount(value)} for label, value in aging.items()],
        "accounts": results,
        "methodology": {"priority": "Up to 60 points for age (capped at 90 days), 30 for relative account balance, and 10 for a missed promise.",
            "holds": "Disputed invoices, active payment promises, and contacts logged in the last two days are excluded from new follow-up targets.",
            "simulation": "A user-defined collection assumption applied to eligible balances. This is a scenario, not a payment prediction.",
            "mrr": "Tax-exclusive monthly value of active contracts held by customers with overdue invoices. It is exposure, not lost revenue."},
    }


def simulate_recovery(db, parameters, analysis=None):
    analysis = analysis or analyze_recovery(db, parameters.min_days_overdue)
    selected = [a for a in analysis["accounts"] if a["eligible_balance"] > 0][:parameters.max_accounts]
    targets = []
    for account in selected:
        modeled = money(money(account["eligible_balance"]) * Decimal(str(parameters.collection_rate)) / 100)
        targets.append({"customer_id": account["customer_id"], "customer_name": account["customer_name"],
            "company_name": account["company_name"], "priority_score": account["priority_score"],
            "eligible_balance": account["eligible_balance"], "modeled_collection": amount(modeled),
            "invoice_ids": [i["invoice_id"] for i in account["invoices"] if i["eligible"]],
            "reasons": account["reasons"], "recommended_action": account["recommended_action"]})
    collection = sum((money(t["modeled_collection"]) for t in targets), Decimal(0))
    targeted = sum((money(t["eligible_balance"]) for t in targets), Decimal(0))
    return {"currency": "INR", "generated_at": analysis["generated_at"], "parameters": parameters.model_dump(),
        "baseline_overdue": analysis["summary"]["overdue_balance"], "targeted_balance": amount(targeted),
        "modeled_collection": amount(collection), "remaining_overdue": amount(money(analysis["summary"]["overdue_balance"]) - collection),
        "target_count": len(targets), "invoice_count": sum(len(t["invoice_ids"]) for t in targets), "targets": targets,
        "disclaimer": "Scenario only. No receipt, invoice adjustment, or customer communication is created."}


def reminder_draft(account, invoice):
    return f"Hello {account['customer_name']},\n\nA quick follow-up on {invoice['invoice_number']}, due {invoice['due_date'][:10]}. The remaining balance is {format_inr(invoice['balance'])} (INR).\n\nPlease confirm a convenient payment date, or let us know if anything on the invoice needs review.\n\nThank you,\nBrightloop billing team"
