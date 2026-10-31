"""INR formatting for API messages, email, and audit descriptions."""
from decimal import Decimal, ROUND_HALF_UP

CURRENCY_CODE = "INR"


def format_inr(amount):
    value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sign = "−" if value < 0 else ""
    whole, fraction = format(abs(value), ".2f").split(".")
    tail, head = whole[-3:], whole[:-3]
    groups = []
    while head:
        groups.append(head[-2:])
        head = head[:-2]
    grouped = ",".join(list(reversed(groups)) + [tail])
    return f"{sign}₹{grouped}.{fraction}"
