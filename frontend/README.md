# BrightLoop — Frontend

Modern, high-performance, production-ready frontend for the **BrightLoop Subscription Management System**, built with React 18, TypeScript, Tailwind CSS, TanStack Query, and Recharts.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will launch at [http://localhost:3000](http://localhost:3000).

### 3. Build for Production
```bash
npm run build
```

---

## 🎨 Design System Highlights

- **Glassmorphism Aesthetic**: Translucent backdrop-blur surfaces, delicate border highlights (`border-white/20`), and subtle indigo glow shadows.
- **Theme Support**: Seamless Dark Mode / Light Mode with instant toggle and `localStorage` persistence.
- **Color Palette**:
  - Primary Gradient: Indigo (`#6366f1`) to Purple (`#8b5cf6`)
  - Status Indicators: Emerald (Active/Paid), Amber (Confirmed/Overdue), Blue (Quotation), Orange (Paused), Rose (Closed/Cancelled)
- **Responsive Layout**:
  - Desktop (>1024px): 280px expanded sidebar
  - Tablet (768px - 1024px): 72px icon-only collapsible sidebar
  - Mobile (<768px): Slide-over drawer with hamburger navigation
- **Role-Based Experience**:
  - **Admin**: Full access (Dashboard, Products, Plans, Subscriptions, Invoices, Payments, Discounts, Team Management)
  - **Staff**: Operational access (Dashboard, Subscriptions, Invoices, Payments)
  - **Customer Portal**: Dedicated distraction-free portal layout (Overview, My Subscriptions, My Invoices)

---

## ⚡ Instant Demo Credentials

For hackathon evaluation, the login page features 1-click demo access buttons:

| Role | Email | Password | Default Redirect |
|---|---|---|---|
| **Admin** | `admin@brightloop.io` | `password123` | `/dashboard` |
| **Staff** | `staff@brightloop.io` | `password123` | `/dashboard` |
| **Customer** | `customer@acme.com` | `password123` | `/portal` |

*Note: You can also toggle roles on-the-fly using the **Role Switcher** in the top navigation bar!*

---

## 🔌 API Integration

All API requests are routed to:
```
http://localhost:8000/api/v1
```

- When the FastAPI backend is running, the frontend makes live authenticated requests with Bearer JWT tokens.
- An intelligent fallback mechanism activates automatically if the backend is offline during frontend-only reviews, ensuring zero crashes and smooth presentation.
