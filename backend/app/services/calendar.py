import calendar
from datetime import datetime, timedelta
from app.models.plan import BillingCycle

def advance(date: datetime, cycle: BillingCycle, count: int = 1) -> datetime:
    if cycle == BillingCycle.daily:
        return date + timedelta(days=count)
    if cycle == BillingCycle.weekly:
        return date + timedelta(weeks=count)
    months = count * (12 if cycle == BillingCycle.yearly else 1)
    index = date.year * 12 + date.month - 1 + months
    year, month = divmod(index, 12)
    return date.replace(year=year, month=month + 1, day=min(date.day, calendar.monthrange(year, month + 1)[1]))

def billing_window(start: datetime, cycle: BillingCycle, now: datetime):
    if cycle in (BillingCycle.daily, BillingCycle.weekly):
        days = 1 if cycle == BillingCycle.daily else 7
        count = max(0, (now - start).days // days)
    else:
        months = (now.year - start.year) * 12 + now.month - start.month
        count = max(0, months // (12 if cycle == BillingCycle.yearly else 1))
        if advance(start, cycle, count) > now:
            count = max(0, count - 1)
    return advance(start, cycle, count), advance(start, cycle, count + 1), count
