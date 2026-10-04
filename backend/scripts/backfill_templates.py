"""
One-time backfill: seed proposal templates for all existing tenants.
"""
import sys
import os

# ⭐ Add backend folder to Python path (fixes ModuleNotFoundError)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.tenant import Tenant
from app.models.industry import Industry, TenantIndustry
from app.services.template_services import create_default_templates_for_industry


def main():
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        print(f"Found {len(tenants)} tenants\n")

        total_created = 0

        for tenant in tenants:
            rows = (
                db.query(Industry.key)
                .join(TenantIndustry, TenantIndustry.industry_id == Industry.id)
                .filter(
                    TenantIndustry.tenant_id == tenant.id,
                    TenantIndustry.status == "active",
                    Industry.is_active == True,
                )
                .all()
            )
            industry_keys = [r[0] for r in rows]

            if not industry_keys:
                print(f"  [{tenant.id}] {tenant.name}: no industries")
                continue

            created_for_tenant = 0
            for industry_key in industry_keys:
                n = create_default_templates_for_industry(
                    db,
                    tenant_id=tenant.id,
                    industry_key=industry_key,
                )
                created_for_tenant += n

            db.commit()
            print(f"  [{tenant.id}] {tenant.name}: +{created_for_tenant} templates (from {industry_keys})")
            total_created += created_for_tenant

        print(f"\n✅ Total templates created: {total_created}")

    finally:
        db.close()


if __name__ == "__main__":
    main()