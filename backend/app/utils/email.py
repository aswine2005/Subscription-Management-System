import logging
from typing import Optional

logger = logging.getLogger("brightloop.email")
logging.basicConfig(level=logging.INFO)

def send_password_reset_email(to_email: str, reset_token: str, full_name: Optional[str] = None) -> bool:
    """
    Simulate sending a password reset email and log formatted message to console.
    """
    greeting = f"Hello {full_name}," if full_name else "Hello,"
    message = f"""
============================================================
[SIMULATED EMAIL SERVICE]
TO: {to_email}
SUBJECT: BrightLoop - Password Reset Request
------------------------------------------------------------
{greeting}

You recently requested to reset your BrightLoop account password.
Please use the following reset token to set a new password:

Reset Token: {reset_token}

This token will expire in 1 hour.
If you did not request this, please disregard this email.
============================================================
"""
    print(message)
    logger.info("Password reset email sent to %s with token %s", to_email, reset_token)
    return True


def send_invoice_notification(to_email: str, invoice_number: str, total_amount: float, due_date: str) -> bool:
    """
    Simulate sending an invoice notification email.
    """
    message = f"""
============================================================
[SIMULATED EMAIL SERVICE]
TO: {to_email}
SUBJECT: BrightLoop - Invoice {invoice_number} Generated
------------------------------------------------------------
Dear Customer,

Your invoice {invoice_number} for the amount of ${total_amount:.2f} has been generated.
Payment is due on {due_date}.

Thank you for choosing BrightLoop!
============================================================
"""
    print(message)
    logger.info("Invoice notification sent to %s for invoice %s", to_email, invoice_number)
    return True
