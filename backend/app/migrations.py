from sqlalchemy import inspect, text
from app.database import Base, engine


def ensure_schema():
    Base.metadata.create_all(bind=engine)
    columns = {column["name"] for column in inspect(engine).get_columns("subscriptions")}
    if "quotation_valid_until" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE subscriptions ADD COLUMN quotation_valid_until DATETIME"))
    upgrade_demo_templates()


def upgrade_demo_templates():
    """Repair only unchanged legacy seed fixtures; preserve user-created quotations."""
    import json
    from app.database import SessionLocal
    from app.models.subscription import QuotationTemplate
    fixes = {
        "Enterprise SaaS Onboarding Pack": [
            ({"product_id": 1, "variant_id": 1, "quantity": 5, "unit_price": 1760.0, "tax_rate": 18.0}, {"product_id": 1, "variant_id": 1, "quantity": 5, "unit_price": 1200.0, "tax_rate": 18.0}),
            ({"product_id": 4, "variant_id": 6, "quantity": 1, "unit_price": 1200.0, "tax_rate": 18.0}, {"product_id": 4, "variant_id": 7, "quantity": 1, "unit_price": 800.0, "tax_rate": 18.0}),
        ],
        "Startup Growth Bundle": [
            ({"product_id": 2, "variant_id": 4, "quantity": 3, "unit_price": 530.0, "tax_rate": 18.0}, {"product_id": 2, "variant_id": 5, "quantity": 3, "unit_price": 450.0, "tax_rate": 18.0}),
        ],
        "Complete Cloud Suite": [
            ({"product_id": 3, "variant_id": 5, "quantity": 1, "unit_price": 430.0, "tax_rate": 18.0}, {"product_id": 3, "variant_id": 6, "quantity": 1, "unit_price": 250.0, "tax_rate": 18.0}),
        ],
    }
    with SessionLocal() as db:
        for template in db.query(QuotationTemplate).filter(QuotationTemplate.name.in_(fixes)).all():
            try:
                lines = json.loads(template.default_lines or "[]")
            except ValueError:
                continue
            original = json.dumps(lines, sort_keys=True)
            for index, line in enumerate(lines):
                for old, new in fixes[template.name]:
                    if line == old:
                        lines[index] = new
            if json.dumps(lines, sort_keys=True) != original:
                template.default_lines = json.dumps(lines)
        db.commit()
