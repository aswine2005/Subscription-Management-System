# Local login and database reference

Open http://localhost:3000. Enter the **email address** and password; no separate username is required. The demo shortcuts use the same real API login.

| Access | Email | Password |
| --- | --- | --- |
| Admin — full configuration and operations | `admin@brightloop.dev` | `Admin@123` |
| Staff — day-to-day subscription/billing work | `sarah.staff@brightloop.dev` | `Staff@123` |
| Staff — another seeded operator | `david.staff@brightloop.dev` | `Staff@123` |
| Customer — only this customer's subscriptions/invoices | `liam.vance@apexglobalsaas.com` | `Customer@123` |

Other seeded customers use `Customer@123`. Newly registered users choose their own password. All four accounts above were checked against the actual database; none of these passwords was changed.

The database is **SQLite at `backend/brightloop.db`**, accessed with SQLAlchemy. It persists across API/UI restarts, and the initial data is seeded only if the database is empty. There is no separate SQLite database-server username or password. Application passwords are stored as bcrypt hashes.

Currency is **INR** for the entire workspace. Existing demo amounts were retained as rupee amounts; the Odoo variant surcharge is ₹560. Monetary API responses declare INR, and receipts support two decimal places (paise).

Password reset and invoice email delivery are implemented. Without SMTP configuration, messages are saved to `backend/outbox/` for local use. Configure SMTP to deliver to real inboxes; see the main README. Payment recording records received funds and does not itself charge a bank account or card.
