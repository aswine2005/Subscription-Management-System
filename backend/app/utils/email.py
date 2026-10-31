import os
import smtplib
from pathlib import Path
from datetime import datetime
from email.message import EmailMessage
from uuid import uuid4
from app.utils.money import format_inr

def deliver(to_email, subject, body):
    message = EmailMessage()
    message['To'] = to_email
    message['From'] = os.getenv('SMTP_FROM', 'billing@brightloop.local')
    message['Subject'] = subject
    message.set_content(body)
    host = os.getenv('SMTP_HOST')
    if host:
        with smtplib.SMTP(host, int(os.getenv('SMTP_PORT', '587')), timeout=10) as smtp:
            smtp.starttls()
            if os.getenv('SMTP_USER'):
                smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
            smtp.send_message(message)
        return True
    outbox = Path(__file__).resolve().parents[2] / 'outbox'
    outbox.mkdir(mode=0o700, exist_ok=True)
    path = outbox / f"{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:8]}.eml"
    path.write_bytes(message.as_bytes())
    path.chmod(0o600)
    return False

def send_password_reset_email(to_email, reset_token, full_name=None):
    url = os.getenv('FRONTEND_URL', 'http://localhost:3000') + '/reset-password?token=' + reset_token
    return deliver(to_email, 'Reset your Brightloop password', f"Hello {full_name or ''},\n\nReset your password: {url}\n\nThis single-use link expires in one hour. If you did not request it, ignore this message.")

def send_invoice_notification(to_email, invoice_number, total_amount, due_date):
    return deliver(to_email, f'Brightloop invoice {invoice_number}', f"Your invoice {invoice_number} totals {format_inr(total_amount)} (INR). Payment is due {due_date}. Open your Brightloop customer portal to view your invoice.")
