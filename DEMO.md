# Brightloop: turn recurring revenue into collected cash

## The product argument

“A subscription dashboard can show healthy recurring revenue while the business is still waiting for cash. Brightloop shows which overdue accounts need attention, explains why, and helps a small team build a collection plan it can actually execute.”

Lead with the Revenue Recovery Lab. Show the source invoices, the explicit assumptions, and a saved plan. Then prove the underlying billing and payment workflow.

## Before the demo

- Start the API on port 8000 and UI on port 3000.
- Run `python prepare_demo.py` from `backend` with its virtual environment active.
- Open the UI and sign in as Admin. The demo customer is Liam Vance.
- Keep automatic generation off for the rehearsal; it is off by default.
- Keep the API test result available. Tests use a separate database.

## The walkthrough

### 0:00 — The business problem

Open Overview. Point out that receipts, outstanding balances, overdue amounts, and MRR answer different questions. All monetary values are INR, and numbers use Indian grouping. MRR excludes taxes; cash collection follows actual payment dates. A partial receipt reduces the outstanding balance.

### 0:30 — The Revenue Recovery Lab

Open Recovery lab. The queue combines all overdue invoices for each customer, accounts for partial receipts, and shows active monthly revenue exposed to late-paying accounts. Open an account: the priority explains age, relative balance, and missed promises. It is an operational rule, not a payment probability.

Set follow-up capacity to three customers and the collection assumption to 50%. Show the modeled collection and remaining overdue amount, then move the assumption to 100%. Save the recovery plan and open its historical snapshot. Saving preserves the assumptions and target accounts; actual receipts stay unchanged.

Show the action menu: a dispute or on-track payment promise holds an invoice out of fresh follow-up targets. Contacted accounts have a two-day cooldown. Promises reconcile against newly recorded completed receipts; overdue unfulfilled promises gain priority. Reminder drafts are prepared for review and are not sent.

### 1:20 — A business rule becomes a real offer

Open a quotation template and apply it to a customer. The plan, product lines, quantity, pricing, and validity window become a persisted quotation. Move it through Confirmed to Active. Quotation validity is separate from the contract term.

### 1:45 — Rehearse billing

Open Billing desk. Ready rows will create invoices; skipped rows explain why nothing will happen. Show that discounts respect the eligible product, dates, minimums, and usage limit. Previewing does not consume a discount.

Run billing. Open the new draft invoice, check its line items and tax/discount totals, then confirm it.

### 2:45 — Close the loop

Record part of the invoice balance using bank transfer or UPI and a recognizable reference. Show the remaining balance and receipt history. Record the remainder; the invoice becomes Paid. Refresh Overview to show the receipts and balance change.

### 3:45 — Prove reliability

Run billing again. It skips the contract period. This is enforced by the database, not a disabled frontend button. Show that changing plan rules affects future invoices while existing invoice totals remain intact.

### 4:15 — Change perspective

Sign out. Use the Customer shortcut. Show the customer's own subscriptions, invoice document, and plan-governed controls. Explain that the server enforces ownership even if someone tries another invoice URL.

### 4:45 — Finish with evidence

Show the passing 31-test API suite and five frontend currency tests and the isolated 1,000-contract benchmark. Mention that the full core workflow runs on the laptop without a cloud subscription or AI API. Email messages remain inspectable locally when SMTP is absent.

## Requirement map

| Requirement | Evidence in the product |
| --- | --- |
| Currency | INR throughout; ₹560 Odoo surcharge; rupee/paise validation and exports |
| Distinctive workflow | Explainable recovery queue, limited-capacity scenarios, persisted plans, receipt-reconciled promises and collection holds |
| Dynamic data | Real API + SQLite; no JS mock store or failure fallback |
| Clean responsive UI | Ink-green navigation, cream workspace, large typographic hierarchy, collection workbench, responsive drawer and dialogs |
| Validation | Client schemas + API rules; no negative prices, invalid percentages, reversed dates, or overpayments |
| Roles | Real JWT sessions; admin provisioning; customer ownership checks |
| Catalog and variants | Product editor and persistent variant surcharge |
| Plans | Four billing cycles, minimums, availability, lifecycle policies |
| Quotes | Database templates and quotation workflow |
| Invoices | Bulk preview/run, draft confirmation, cancellation, send, Print/PDF |
| Discounts and taxes | Admin rules consumed automatically during billing |
| Payments | Multiple receipt methods, date/reference, partial settlement |
| Revenue reports | Live MRR, receipts, outstanding/overdue balances, report CSV |
| Local resilience | SQLite, optional local scheduler, email outbox |
| Performance | Reproducible 1,000-contract read-path benchmark |
| Team Git practice | Team members must make their own real contributions and review PRs |

## Be precise with judges

Call the data “seeded demo business data” and the payment feature a “receipt ledger.” Do not claim a card gateway, a deployed production service, email delivery without SMTP, or guaranteed selection. Call recovery outputs “modeled collection,” not guaranteed revenue or AI predictions. Explain the next integration clearly if asked.
