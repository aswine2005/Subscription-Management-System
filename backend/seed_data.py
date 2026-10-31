import os
import sys
from datetime import datetime, timedelta
import random

# Ensure app can be imported when running standalone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base, SessionLocal
from app.models.user import User, UserRole
from app.models.product import Product, ProductVariant, ProductType
from app.models.plan import Plan, BillingCycle
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionStatus, QuotationTemplate
from app.models.invoice import Invoice, InvoiceLine, InvoiceStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.discount import Discount, TaxRule, ActivityLog, DiscountType, DiscountAppliesTo
from app.utils.security import get_password_hash


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if database already has users
    existing_users = db.query(User).count()
    if existing_users > 0:
        print("[SEED] Database already populated. Skipping seeding.")
        db.close()
        return

    print("[SEED] Starting comprehensive database population for BrightLoop...")

    # 1. Create Admin & Staff Users
    admin_user = User(
        email="admin@brightloop.dev",
        hashed_password=get_password_hash("Admin@123"),
        full_name="Alexander Wright",
        company_name="BrightLoop HQ",
        phone="+1-555-0100",
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin_user)

    staff_1 = User(
        email="sarah.staff@brightloop.dev",
        hashed_password=get_password_hash("Staff@123"),
        full_name="Sarah Jenkins",
        company_name="BrightLoop Operations",
        phone="+1-555-0101",
        role=UserRole.staff,
        is_active=True,
    )
    staff_2 = User(
        email="david.staff@brightloop.dev",
        hashed_password=get_password_hash("Staff@123"),
        full_name="David Miller",
        company_name="BrightLoop Customer Success",
        phone="+1-555-0102",
        role=UserRole.staff,
        is_active=True,
    )
    db.add_all([staff_1, staff_2])
    db.flush()

    # 2. Create 15 Realistic Customers
    customer_profiles = [
        ("Liam Vance", "liam.vance@apexglobalsaas.com", "Apex Global Inc.", "+1-555-0201"),
        ("Elena Rostova", "elena@nexustechnologies.io", "Nexus Tech Corp", "+1-555-0202"),
        ("Marcus Brody", "marcus@vertexsolutions.co", "Vertex Solutions Ltd", "+1-555-0203"),
        ("Sophia Chen", "schen@horizondynamics.com", "Horizon Dynamics LLC", "+1-555-0204"),
        ("Naveen Patel", "naveen@stellaranalytics.in", "Stellar Analytics Pvt", "+91-9876543210"),
        ("Rachel Green", "rachel@summitlogistics.org", "Summit Logistics Inc", "+1-555-0206"),
        ("Julian Thorne", "julian@vanguardmedia.com", "Vanguard Media Group", "+1-555-0207"),
        ("Claire Sterling", "csterling@bluewaveretail.com", "BlueWave Retail", "+1-555-0208"),
        ("Dr. Jonathan Hayes", "jhayes@orionhealth.net", "Orion Healthcare Systems", "+1-555-0209"),
        ("Maya Lindqvist", "maya@solariscleanenergy.eu", "Solaris Energy Nordic", "+46-8-123456"),
        ("Carlos Mendes", "carlos@quantumsoftlabs.com", "Quantum Software Labs", "+1-555-0211"),
        ("Aisha Al-Mansoor", "aisha@zenithrobotics.ae", "Zenith Robotics FZ", "+971-4-987654"),
        ("Oliver Queen", "oliver@pulsefinancialtech.com", "Pulse Financial Tech", "+1-555-0213"),
        ("Hannah Abbott", "hannah@novabiotech.co.uk", "Nova BioTech UK", "+44-20-7946-0921"),
        ("Vikram Singhania", "vikram@alpinecloud.io", "Alpine Cloud Systems", "+91-9123456789"),
    ]

    customers = []
    for name, email, company, phone in customer_profiles:
        cust = User(
            email=email,
            hashed_password=get_password_hash("Customer@123"),
            full_name=name,
            company_name=company,
            phone=phone,
            role=UserRole.customer,
            is_active=True,
        )
        db.add(cust)
        customers.append(cust)
    db.flush()

    # 3. Create 5 Products with Variants
    products_data = [
        {
            "name": "Cloud ERP Suite",
            "type": ProductType.software,
            "sales_price": 1200.0,
            "cost_price": 300.0,
            "description": "Enterprise cloud ERP system featuring inventory, finance, human resources, and supply chain management.",
            "variants": [
                ("Odoo Brand Edition", 560.0),
                ("Enterprise Security Pack", 250.0),
                ("Custom Domain Integration", 120.0),
            ]
        },
        {
            "name": "Omnichannel CRM",
            "type": ProductType.software,
            "sales_price": 450.0,
            "cost_price": 90.0,
            "description": "Unified customer relationship management with pipeline automation, email workflows, and sales scoring.",
            "variants": [
                ("AI Sales Copilot", 150.0),
                ("Telephony VoIP Integration", 80.0),
            ]
        },
        {
            "name": "Automated Invoicing & Payroll Addon",
            "type": ProductType.addon,
            "sales_price": 250.0,
            "cost_price": 40.0,
            "description": "Multi-currency tax compliance, automated recurring billing, direct deposit payroll, and reconciliation.",
            "variants": [
                ("Multi-Entity Consolidation", 180.0),
            ]
        },
        {
            "name": "Dedicated Account Manager & 24/7 SLA",
            "type": ProductType.service,
            "sales_price": 800.0,
            "cost_price": 200.0,
            "description": "Assigned Senior Solutions Architect with 15-minute guaranteed SLA and quarterly architectural reviews.",
            "variants": [
                ("Dedicated DevOps Support", 400.0),
            ]
        },
        {
            "name": "Enterprise Cloud Backup & Disaster Recovery",
            "type": ProductType.addon,
            "sales_price": 350.0,
            "cost_price": 70.0,
            "description": "Hourly immutable snapshots, geo-replicated hot standby, and zero-loss automated failover.",
            "variants": [
                ("10TB Storage Extension", 220.0),
                ("Cold Archive Tier", 90.0),
            ]
        },
    ]

    created_products = []
    created_variants = {}
    for pdata in products_data:
        prod = Product(
            name=pdata["name"],
            type=pdata["type"],
            sales_price=pdata["sales_price"],
            cost_price=pdata["cost_price"],
            description=pdata["description"],
            is_active=True,
        )
        db.add(prod)
        db.flush()
        created_products.append(prod)
        created_variants[prod.id] = []

        for vname, vprice in pdata["variants"]:
            var = ProductVariant(
                product_id=prod.id,
                name=vname,
                additional_price=vprice,
                is_active=True,
            )
            db.add(var)
            db.flush()
            created_variants[prod.id].append(var)

    # 4. Create 8 Plans across Billing Cycles
    plans_data = [
        ("ERP Monthly Growth", created_products[0].id, BillingCycle.monthly, 120.0, 1, True, True, True),
        ("ERP Annual Enterprise", created_products[0].id, BillingCycle.yearly, 1200.0, 5, True, True, True),
        ("CRM Starter Monthly", created_products[1].id, BillingCycle.monthly, 45.0, 1, True, True, True),
        ("CRM Pro Annual", created_products[1].id, BillingCycle.yearly, 450.0, 2, True, True, True),
        ("Payroll Daily Flex", created_products[2].id, BillingCycle.daily, 10.0, 1, False, True, True),
        ("Payroll Weekly Scale", created_products[2].id, BillingCycle.weekly, 60.0, 1, True, True, True),
        ("Dedicated SLA Monthly", created_products[3].id, BillingCycle.monthly, 800.0, 1, True, False, True),
        ("Cloud Backup Annual", created_products[4].id, BillingCycle.yearly, 350.0, 1, True, True, True),
    ]

    created_plans = []
    for name, prod_id, cycle, price, min_q, allow_p, allow_ec, allow_ren in plans_data:
        plan = Plan(
            name=name,
            product_id=prod_id,
            billing_cycle=cycle,
            price=price,
            min_quantity=min_q,
            available_from=datetime.utcnow() - timedelta(days=365),
            auto_close=False,
            allow_pause=allow_p,
            allow_early_close=allow_ec,
            allow_renewal=allow_ren,
            is_active=True,
        )
        db.add(plan)
        created_plans.append(plan)
    db.flush()

    # 5. Create 3 Tax Rules
    tax_rules_data = [
        ("GST Standard (18%)", 18.0, "Standard Goods and Services Tax applicable to software services", True),
        ("VAT Technology (10%)", 10.0, "Technology & Information Services VAT", False),
        ("Infrastructure Surcharge (2%)", 2.0, "High availability multi-cloud infrastructure surcharge", False),
    ]
    created_taxes = []
    for tname, rate, desc, is_act in tax_rules_data:
        tax = TaxRule(name=tname, rate=rate, description=desc, is_active=is_act)
        db.add(tax)
        created_taxes.append(tax)
    db.flush()

    # 6. Create 5 Discount Rules
    discounts_data = [
        ("WELCOME20", "WELCOME20", DiscountType.percentage, 20.0, 100.0, 1, DiscountAppliesTo.subscription, None, 200, 42),
        ("STARTUP100", "STARTUP100", DiscountType.fixed, 100.0, 300.0, 1, DiscountAppliesTo.subscription, None, 50, 18),
        ("ANNUAL25", "ANNUAL25", DiscountType.percentage, 25.0, 500.0, 1, DiscountAppliesTo.subscription, None, 100, 29),
        ("ADDON15", "ADDON15", DiscountType.percentage, 15.0, 50.0, 1, DiscountAppliesTo.product, created_products[2].id, 150, 12),
        ("VIPFLAT50", "VIPFLAT50", DiscountType.fixed, 50.0, 200.0, 1, DiscountAppliesTo.subscription, None, 50, 7),
    ]
    created_discounts = []
    for dname, code, dtype, val, min_p, min_q, app_to, p_id, max_u, cur_u in discounts_data:
        disc = Discount(
            name=dname,
            code=code,
            type=dtype,
            value=val,
            min_purchase_amount=min_p,
            min_quantity=min_q,
            start_date=datetime.utcnow() - timedelta(days=365),
            end_date=datetime.utcnow() + timedelta(days=365),
            max_uses=max_u,
            current_uses=cur_u,
            applies_to=app_to,
            product_id=p_id,
            is_active=True,
        )
        db.add(disc)
        created_discounts.append(disc)
    db.flush()

    # 7. Create 3 Quotation Templates
    quotation_templates_data = [
        (
            "Enterprise SaaS Onboarding Pack",
            created_plans[1].id,  # ERP Annual Enterprise
            30,
            '[{"product_id": 1, "variant_id": 1, "quantity": 5, "unit_price": 1200.0, "tax_rate": 18.0}, {"product_id": 4, "variant_id": 7, "quantity": 1, "unit_price": 800.0, "tax_rate": 18.0}]'
        ),
        (
            "Startup Growth Bundle",
            created_plans[2].id,  # CRM Starter Monthly
            15,
            '[{"product_id": 2, "variant_id": 5, "quantity": 3, "unit_price": 450.0, "tax_rate": 18.0}]'
        ),
        (
            "Complete Cloud Suite",
            created_plans[0].id,  # ERP Monthly Growth
            45,
            '[{"product_id": 1, "variant_id": null, "quantity": 1, "unit_price": 1200.0, "tax_rate": 18.0}, {"product_id": 3, "variant_id": 6, "quantity": 1, "unit_price": 250.0, "tax_rate": 18.0}]'
        ),
    ]
    for qname, plan_id, val_days, default_lines in quotation_templates_data:
        qtemplate = QuotationTemplate(
            name=qname,
            plan_id=plan_id,
            validity_days=val_days,
            default_lines=default_lines,
            is_active=True,
        )
        db.add(qtemplate)
    db.flush()

    # 8. Create 50 Subscriptions with realistic distribution of statuses
    # 25 active, 8 draft, 6 quotation, 5 confirmed, 3 paused, 3 closed
    sub_statuses = (
        [SubscriptionStatus.active] * 25 +
        [SubscriptionStatus.draft] * 8 +
        [SubscriptionStatus.quotation] * 6 +
        [SubscriptionStatus.confirmed] * 5 +
        [SubscriptionStatus.paused] * 3 +
        [SubscriptionStatus.closed] * 3
    )
    random.shuffle(sub_statuses)

    created_subs: List[Subscription] = []
    now = datetime.utcnow()

    payment_term_options = ["Immediate", "Net 15", "Net 30"]

    for idx, status in enumerate(sub_statuses):
        cust = customers[idx % len(customers)]
        plan = created_plans[idx % len(created_plans)]
        
        # Spread creation across the past 12 months
        days_ago = random.randint(5, 330)
        start_date = now - timedelta(days=days_ago)
        expiry_date = start_date + timedelta(days=365)
        next_billing = now + timedelta(days=random.randint(1, 28))

        sub_num = f"SUB-{now.year}-{idx + 1:05d}"
        sub = Subscription(
            subscription_number=sub_num,
            customer_id=cust.id,
            plan_id=plan.id,
            start_date=start_date,
            expiry_date=expiry_date,
            next_billing_date=next_billing,
            payment_terms=random.choice(payment_term_options),
            status=status,
            created_by=admin_user.id if idx % 2 == 0 else staff_1.id,
            notes=f"Subscription configured for {cust.company_name} on {plan.name}",
            created_at=start_date,
            updated_at=start_date,
        )
        db.add(sub)
        db.flush()
        created_subs.append(sub)

        # Core subscription line for the plan product
        core_prod = plan.product
        core_variant = created_variants[core_prod.id][0] if (idx % 3 == 0 and created_variants[core_prod.id]) else None
        qty = max(plan.min_quantity, (idx % 4) + 1)
        unit_price = core_prod.sales_price + (core_variant.additional_price if core_variant else 0.0)
        subtotal = round(qty * unit_price, 2)
        tax_rate = 18.0
        total = round(subtotal * (1 + tax_rate / 100.0), 2)

        line = SubscriptionLine(
            subscription_id=sub.id,
            product_id=core_prod.id,
            variant_id=core_variant.id if core_variant else None,
            quantity=qty,
            unit_price=unit_price,
            tax_rate=tax_rate,
            subtotal=subtotal,
            total=total,
            created_at=start_date,
            updated_at=start_date,
        )
        db.add(line)

        # Extra line item for some subscriptions
        if idx % 2 == 0:
            extra_prod = created_products[2]  # Addon
            extra_qty = 1
            extra_price = extra_prod.sales_price
            extra_sub = round(extra_qty * extra_price, 2)
            extra_tot = round(extra_sub * (1 + tax_rate / 100.0), 2)
            db.add(SubscriptionLine(
                subscription_id=sub.id,
                product_id=extra_prod.id,
                variant_id=None,
                quantity=extra_qty,
                unit_price=extra_price,
                tax_rate=tax_rate,
                subtotal=extra_sub,
                total=extra_tot,
                created_at=start_date,
                updated_at=start_date,
            ))

    db.flush()

    # 9. Create 100 Invoices with realistic statuses
    # 55 paid, 25 confirmed, 10 overdue, 6 draft, 4 cancelled
    invoice_statuses = (
        [InvoiceStatus.paid] * 55 +
        [InvoiceStatus.confirmed] * 25 +
        [InvoiceStatus.overdue] * 10 +
        [InvoiceStatus.draft] * 6 +
        [InvoiceStatus.cancelled] * 4
    )
    random.shuffle(invoice_statuses)

    created_invoices: List[Invoice] = []

    for idx, inv_status in enumerate(invoice_statuses):
        sub = created_subs[idx % len(created_subs)]
        cust = sub.customer

        # Generate realistic issue and due dates across the last 12 months
        if inv_status == InvoiceStatus.overdue:
            # Overdue means due_date was in the past
            days_ago = random.randint(30, 180)
            issue_date = now - timedelta(days=days_ago)
            due_date = issue_date + timedelta(days=15)
        elif inv_status == InvoiceStatus.paid:
            days_ago = random.randint(15, 300)
            issue_date = now - timedelta(days=days_ago)
            due_date = issue_date + timedelta(days=15)
        elif inv_status == InvoiceStatus.confirmed:
            # Due date in the future
            issue_date = now - timedelta(days=random.randint(1, 10))
            due_date = issue_date + timedelta(days=15)
        else:
            issue_date = now - timedelta(days=random.randint(5, 60))
            due_date = issue_date + timedelta(days=15)

        inv_num = f"INV-{now.year}-{idx + 1:05d}"

        # Subtotal calculation from subscription lines
        lines_subtotal = round(sum(l.subtotal for l in sub.lines), 2)
        discount_amount = 0.0
        if idx % 3 == 0:
            discount_amount = round(lines_subtotal * 0.10, 2)

        taxable = max(0.0, lines_subtotal - discount_amount)
        tax_amount = round(taxable * 0.18, 2)
        total = round(taxable + tax_amount, 2)

        inv = Invoice(
            invoice_number=inv_num,
            subscription_id=sub.id,
            customer_id=cust.id,
            issue_date=issue_date,
            due_date=due_date,
            status=inv_status,
            subtotal=lines_subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total=total,
            notes=f"Billing cycle invoice for {sub.subscription_number}",
            created_at=issue_date,
            updated_at=issue_date,
        )
        db.add(inv)
        db.flush()
        created_invoices.append(inv)

        # Add invoice lines mirroring subscription lines
        for sl in sub.lines:
            inv_line = InvoiceLine(
                invoice_id=inv.id,
                product_id=sl.product_id,
                variant_id=sl.variant_id,
                quantity=sl.quantity,
                unit_price=sl.unit_price,
                tax_rate=sl.tax_rate,
                subtotal=sl.subtotal,
                total=sl.total,
                created_at=issue_date,
                updated_at=issue_date,
            )
            db.add(inv_line)

    db.flush()

    # 10. Create 80 Payments across invoices
    # All 55 paid invoices get fully paid (either single or partial payments)
    # Some confirmed invoices get partial payments
    payment_methods = [
        PaymentMethod.bank_transfer,
        PaymentMethod.credit_card,
        PaymentMethod.upi,
        PaymentMethod.cash,
    ]

    payment_count = 0
    # Fully pay the 55 paid invoices
    paid_invoices = [inv for inv in created_invoices if inv.status == InvoiceStatus.paid]
    for inv in paid_invoices:
        # Split into 2 partial payments for some invoices to demonstrate partial payment tracking
        if payment_count % 3 == 0 and payment_count < 75:
            part1 = round(inv.total * 0.40, 2)
            part2 = round(inv.total - part1, 2)
            date1 = inv.issue_date + timedelta(days=2)
            date2 = inv.issue_date + timedelta(days=6)

            payment_count += 1
            pay1 = Payment(
                payment_number=f"PAY-{now.year}-{payment_count:05d}",
                invoice_id=inv.id,
                amount=part1,
                payment_date=date1,
                payment_method=random.choice(payment_methods),
                reference_note="First installment / Partial payment",
                status=PaymentStatus.completed,
                created_at=date1,
                updated_at=date1,
            )
            db.add(pay1)

            payment_count += 1
            pay2 = Payment(
                payment_number=f"PAY-{now.year}-{payment_count:05d}",
                invoice_id=inv.id,
                amount=part2,
                payment_date=date2,
                payment_method=random.choice(payment_methods),
                reference_note="Final settlement payment",
                status=PaymentStatus.completed,
                created_at=date2,
                updated_at=date2,
            )
            db.add(pay2)
        else:
            payment_count += 1
            p_date = inv.issue_date + timedelta(days=random.randint(1, 10))
            pay = Payment(
                payment_number=f"PAY-{now.year}-{payment_count:05d}",
                invoice_id=inv.id,
                amount=inv.total,
                payment_date=p_date,
                payment_method=random.choice(payment_methods),
                reference_note=f"Payment for invoice {inv.invoice_number}",
                status=PaymentStatus.completed,
                created_at=p_date,
                updated_at=p_date,
            )
            db.add(pay)

    # Some confirmed invoices have partial payments
    confirmed_invoices = [inv for inv in created_invoices if inv.status == InvoiceStatus.confirmed]
    for inv in confirmed_invoices[:10]:
        if payment_count >= 80:
            break
        payment_count += 1
        part = round(inv.total * 0.50, 2)
        p_date = inv.issue_date + timedelta(days=1)
        pay = Payment(
            payment_number=f"PAY-{now.year}-{payment_count:05d}",
            invoice_id=inv.id,
            amount=part,
            payment_date=p_date,
            payment_method=random.choice(payment_methods),
            reference_note=f"Partial advance payment on {inv.invoice_number}",
            status=PaymentStatus.completed,
            created_at=p_date,
            updated_at=p_date,
        )
        db.add(pay)

    # Fill remaining payments up to 80 if needed
    while payment_count < 80:
        payment_count += 1
        target_inv = created_invoices[payment_count % len(created_invoices)]
        p_date = now - timedelta(days=random.randint(5, 50))
        pay = Payment(
            payment_number=f"PAY-{now.year}-{payment_count:05d}",
            invoice_id=target_inv.id,
            amount=round(random.uniform(50.0, 250.0), 2),
            payment_date=p_date,
            payment_method=random.choice(payment_methods),
            reference_note="Service credit applied",
            status=PaymentStatus.completed,
            created_at=p_date,
            updated_at=p_date,
        )
        db.add(pay)

    # 11. Create 25 Activity Logs for Rich Audit Trail
    actions = [
        ("user_logged_in", "user", admin_user.id, "Admin logged into system console"),
        ("subscription_created", "subscription", created_subs[0].id, "New subscription SUB-2026-00001 created"),
        ("invoice_generated", "invoice", created_invoices[0].id, "Invoice INV-2026-00001 auto-generated"),
        ("payment_recorded", "payment", 1, "Payment of ₹1,416.00 settled via Credit Card"),
        ("subscription_status_transition", "subscription", created_subs[1].id, "Subscription transitioned to active"),
        ("discount_created", "discount", 1, "Discount campaign WELCOME20 launched"),
        ("tax_rule_created", "tax_rule", 1, "Standard GST rule (18%) activated"),
        ("quotation_template_created", "quotation_template", 1, "Template Enterprise SaaS Onboarding Pack published"),
        ("subscription_paused", "subscription", created_subs[3].id, "Subscription paused upon customer request"),
        ("subscription_resumed", "subscription", created_subs[3].id, "Subscription resumed"),
        ("user_registered", "user", customers[0].id, "Customer Liam Vance signed up"),
        ("staff_account_created", "user", staff_1.id, "Staff account Sarah Jenkins created"),
        ("bulk_invoicing_executed", "billing", None, "Monthly billing cycle executed: 25 invoices generated"),
        ("product_created", "product", 1, "Product Cloud ERP Suite cataloged"),
        ("plan_created", "plan", 1, "Plan ERP Monthly Growth created"),
        ("invoice_updated", "invoice", created_invoices[5].id, "Invoice due date extended by 15 days"),
        ("payment_recorded", "payment", 15, "Payment settled via Bank Transfer"),
        ("subscription_status_transition", "subscription", created_subs[4].id, "Quotation accepted and confirmed"),
        ("password_reset_completed", "user", customers[2].id, "Customer password successfully changed"),
        ("user_profile_updated", "user", customers[1].id, "Updated billing address and contact phone"),
    ]

    for idx, (action, etype, eid, details) in enumerate(actions):
        log_time = now - timedelta(hours=(len(actions) - idx) * 3)
        log = ActivityLog(
            user_id=admin_user.id if idx % 2 == 0 else staff_1.id,
            action=action,
            entity_type=etype,
            entity_id=eid,
            details=details,
            created_at=log_time,
        )
        db.add(log)

    db.commit()
    db.close()
    print("[SEED] Successfully seeded:")
    print(f"  - 1 Admin, 2 Staff, 15 Customers (Total Users: {1 + 2 + 15})")
    print(f"  - 5 Products with multiple variants")
    print(f"  - 8 Subscription Plans")
    print(f"  - 3 Tax Rules, 5 Discount Campaigns, 3 Quotation Templates")
    print(f"  - 50 Subscriptions")
    print(f"  - 100 Invoices")
    print(f"  - {payment_count} Payments")
    print(f"  - {len(actions)} Activity Logs")


if __name__ == "__main__":
    seed_database()
