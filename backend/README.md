# BrightLoop Backend — Subscription Management System

Production-grade FastAPI and SQLAlchemy backend API for BrightLoop Subscription Management System.

## Features
- **JWT Authentication & RBAC**: Role-based access control supporting `admin`, `staff`, and `customer` roles with strict password strength validation.
- **Product & Variant Catalog**: Multi-tier products (software, addons, services) with customizable add-on variants (e.g. Odoo Brand edition).
- **Subscription Plans**: Flexible plans across daily, weekly, monthly, and yearly cycles with pause/early close governance.
- **Subscription Lifecycle**: Full state transitions (`draft` → `quotation` → `confirmed` → `active` ⇄ `paused` → `closed`) with quotation template generation.
- **Automated Invoicing & Duplicate Protection**: Period-based duplicate billing protection, automated tax rule calculation, and dynamic discount engine.
- **Flexible Payments**: Support for credit card, bank transfer, UPI, and cash with partial payment handling and real-time outstanding balance tracking.
- **Executive Analytics & MRR Dashboard**: Live calculation of MRR, ARR, churn rate, overdue invoices, 12-month revenue trend, and recent audit logs.

---

## Quick Start

### 1. Installation
Ensure Python 3.10+ is installed:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Database Seeding & Server
```bash
python run.py
```
`run.py` will automatically:
1. Initialize SQLite database tables (`brightloop.db`).
2. Populate seed data if the database is clean.
3. Launch Uvicorn server on `http://localhost:8000`.

### 3. API Documentation
Once the server is running, visit:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## Default Seed Accounts
| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@brightloop.dev` | `Admin@123` |
| **Staff** | `sarah.staff@brightloop.dev` | `Staff@123` |
| **Staff** | `david.staff@brightloop.dev` | `Staff@123` |
| **Customer** | `liam.vance@apexglobalsaas.com` | `Customer@123` |

---

## API Overview (`/api/v1/`)
- `/auth`: Registration, Login, Token generation, Password reset simulation.
- `/users`: Staff provisioning, user directory, profile management.
- `/products`: Product catalog and variant pricing.
- `/plans`: Subscription plans and billing cycle rules.
- `/subscriptions`: Subscription contracts, status transitions, quotation templates.
- `/invoices`: Invoices, line items, bulk billing generation.
- `/payments`: Payment recording, partial payment support, invoice settlement.
- `/discounts`: Discount rules and tax configuration.
- `/dashboard/summary`: Executive analytics, MRR, ARR, and activity log.
