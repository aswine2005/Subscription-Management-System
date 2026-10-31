# 🚀 BrightLoop — Subscription Management System

## Architecture & Setup Guide

### What Makes BrightLoop Unique

| Feature | Typical Hackathon Projects | BrightLoop |
|---|---|---|
| **Data** | Static JSON files | Real SQLite DB with SQLAlchemy ORM + 250+ seeded records |
| **Auth** | Basic login | JWT + RBAC (Admin/Staff/Customer) with proper password policy |
| **UI** | Bootstrap templates | Custom glassmorphism design system with dark/light mode |
| **Analytics** | Basic counts | MRR, ARR, churn rate, revenue trends, customer segmentation |
| **Billing** | Manual | Automated bulk invoice generation with tax & discount auto-application |
| **Architecture** | Monolith | Clean separation: FastAPI → Services → Models → SQLAlchemy |
| **Validation** | Server-only | Dual: Zod (client) + Pydantic (server) with real-time feedback |

---

### Tech Stack

```mermaid
flowchart LR
    subgraph Frontend ["Frontend (React 18 + TypeScript)"]
        A[Vite] --> B[React Router v6]
        B --> C[TanStack Query]
        C --> D[React Hook Form + Zod]
        B --> E[Recharts]
        B --> F[Tailwind CSS + Glassmorphism]
    end

    subgraph Backend ["Backend (FastAPI + Python)"]
        G[FastAPI] --> H[Pydantic v2]
        G --> I[SQLAlchemy 2.0]
        I --> J[(SQLite)]
        G --> K[JWT Auth]
        G --> L[Services Layer]
    end

    Frontend -->|REST API| Backend
```

---

### Quick Start

#### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```
Backend runs at **http://localhost:8000**. API docs at **/docs**.

#### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at **http://localhost:5173**

#### 3. Login Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@brightloop.dev | Admin@123 |
| Staff | sarah@brightloop.dev | Staff@123 |
| Staff | mike@brightloop.dev | Staff@123 |
| Customer | (any seeded customer) | Customer@123 |

---

### System Architecture

```mermaid
flowchart TD
    subgraph Clients
        A["🌐 Admin Dashboard"]
        B["👤 Staff Portal"]
        C["🏢 Customer Portal"]
    end

    subgraph API ["FastAPI Backend"]
        D[Auth Routes] --> E[JWT Middleware]
        F[Product Routes] --> E
        G[Plan Routes] --> E
        H[Subscription Routes] --> E
        I[Invoice Routes] --> E
        J[Payment Routes] --> E
        K[Discount Routes] --> E
        L[Dashboard Routes] --> E
    end

    subgraph Services
        M[Auth Service]
        N[Billing Service]
        O[Subscription Service]
        P[Analytics Service]
    end

    subgraph Database
        Q[(SQLite via SQLAlchemy)]
    end

    A & B & C -->|HTTPS / REST| API
    E --> Services
    Services --> Database
```

---

### Database Schema

```mermaid
erDiagram
    USERS ||--o{ SUBSCRIPTIONS : "has"
    USERS ||--o{ INVOICES : "receives"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : "has"
    PRODUCTS ||--o{ PLANS : "offered_as"
    PLANS ||--o{ SUBSCRIPTIONS : "used_in"
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_LINES : "contains"
    SUBSCRIPTIONS ||--o{ INVOICES : "generates"
    INVOICES ||--o{ INVOICE_LINES : "contains"
    INVOICES ||--o{ PAYMENTS : "paid_by"
    DISCOUNTS ||--o{ INVOICES : "applied_to"
    TAX_RULES ||--o{ INVOICE_LINES : "applied_to"

    USERS {
        int id PK
        string email UK
        string hashed_password
        string full_name
        enum role "admin|staff|customer"
        bool is_active
        datetime created_at
    }

    PRODUCTS {
        int id PK
        string name
        enum type "software|addon|service"
        decimal sales_price
        decimal cost_price
        text description
        bool is_active
    }

    PLANS {
        int id PK
        int product_id FK
        string name
        enum billing_cycle "daily|weekly|monthly|yearly"
        decimal price
        int min_quantity
        date available_from
        date available_to
        bool auto_close
        bool allow_early_close
        bool allow_pause
        bool allow_renewal
    }

    SUBSCRIPTIONS {
        int id PK
        string subscription_number UK
        int customer_id FK
        int plan_id FK
        date start_date
        date expiry_date
        string payment_terms
        enum status "draft|quotation|confirmed|active|paused|closed"
        int created_by FK
    }

    INVOICES {
        int id PK
        string invoice_number UK
        int subscription_id FK
        int customer_id FK
        date issue_date
        date due_date
        enum status "draft|confirmed|paid|cancelled|overdue"
        decimal subtotal
        decimal tax_amount
        decimal discount_amount
        decimal total
    }

    PAYMENTS {
        int id PK
        int invoice_id FK
        decimal amount
        date payment_date
        enum method "bank_transfer|credit_card|upi|cash"
        string reference_note
    }

    DISCOUNTS {
        int id PK
        string name
        enum type "fixed|percentage"
        decimal value
        decimal min_purchase
        int min_quantity
        date start_date
        date end_date
        int max_uses
        int current_uses
    }
```

---

### Git Branching Strategy

For your team of 3-4 members:

```
main (production-ready)
  └── develop (integration)
       ├── feature/auth         (Member 1)
       ├── feature/billing      (Member 2)
       ├── feature/dashboard    (Member 3)
       └── feature/ui-polish    (Member 4)
```

**Rules:**
1. Never push directly to `main`
2. Create feature branches from `develop`
3. Do Pull Requests for code review
4. Merge to `develop` first, then `develop` → `main`

```bash
# Team setup commands
git checkout -b develop
git push -u origin develop

# Each member:
git checkout develop
git pull origin develop
git checkout -b feature/your-feature
# ... work ...
git add . && git commit -m "feat: description"
git push -u origin feature/your-feature
# Then create PR on GitHub
```

---

### API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Customer registration |
| POST | `/api/v1/auth/login` | Public | Login, returns JWT |
| POST | `/api/v1/auth/forgot-password` | Public | Password reset request |
| GET | `/api/v1/users` | Admin | List all users |
| POST | `/api/v1/users/staff` | Admin | Create staff user |
| GET/POST | `/api/v1/products` | Admin | Manage products |
| GET/POST | `/api/v1/plans` | Admin | Manage plans |
| GET/POST | `/api/v1/subscriptions` | Staff+ | Manage subscriptions |
| PATCH | `/api/v1/subscriptions/{id}/status` | Staff+ | Transition status |
| GET/POST | `/api/v1/invoices` | Staff+ | Manage invoices |
| POST | `/api/v1/invoices/generate-bulk` | Staff+ | Bulk billing |
| GET/POST | `/api/v1/payments` | Staff+ | Record payments |
| GET/POST | `/api/v1/discounts` | Admin | Manage discounts |
| GET | `/api/v1/dashboard/summary` | Staff+ | Analytics data |

---

> [!TIP]
> The seeded database contains 12 months of realistic data, making dashboard charts look impressive from the first demo.
