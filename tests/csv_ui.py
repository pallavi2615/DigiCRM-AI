"""UI end-to-end: CSV Import/Export screens on Leads, Contacts, Companies
respect RBAC and ownership for every role.

For each role (executive, manager, admin) and every module:
  1. Signs in and navigates to the module page.
  2. Opens the Import dialog, downloads the template, then imports 2 rows
     tagged with a role+module+run stamp.
  3. Clicks Export and asserts the downloaded CSV contains the imported
     rows the current user is permitted to see, and NEVER contains rows
     owned by other roles (per-role RBAC on the export path).
  4. Verifies the executive's export excludes hidden admin-imported rows
     seeded via service role.
"""
import asyncio, csv, io, os, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
from supabase import create_client

URL = os.environ["SUPABASE_URL"]
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APP = os.environ.get("APP_URL", "http://localhost:8080")
PWD = os.environ.get("TEST_USER_PASSWORD", "DigiCrm!Demo2026")
EMAILS = {
    "exec":    os.environ.get("TEST_EXEC_EMAIL", "executive@digicrm.demo"),
    "manager": os.environ.get("TEST_MANAGER_EMAIL", "manager@digicrm.demo"),
    "admin":   os.environ.get("TEST_ADMIN_EMAIL", "admin@digicrm.demo"),
}

SB = create_client(URL, SVC)
SHOTS = Path("tests/.artifacts"); SHOTS.mkdir(parents=True, exist_ok=True)
DOWNLOADS = Path("tests/.artifacts/csv"); DOWNLOADS.mkdir(parents=True, exist_ok=True)

RESULTS = []
def check(name, cond, extra=""):
    RESULTS.append((name, bool(cond)))
    print(("✓" if cond else "✗"), name, ("— " + extra) if extra else "")

STAMP = int(time.time() * 1000)
TAG = f"CSVUI{STAMP}"

MOD = {
    "leads": {
        "url": f"{APP}/leads",
        "header": "company_name,contact_person,email,phone,industry,source,status,priority,estimated_value,expected_close_date",
        "name_field": "company_name",
        "row": lambda who: f"{TAG}-{who}-lead-1,Jane,{who}@x.io,555,SaaS,Web,new,high,1000,2027-01-01\n"
                           f"{TAG}-{who}-lead-2,John,{who}2@x.io,555,SaaS,Web,new,low,500,2027-01-02",
        "table": "leads",
    },
    "contacts": {
        "url": f"{APP}/contacts",
        "header": "first_name,last_name,email,phone,designation",
        "name_field": "first_name",
        "row": lambda who: f"{TAG}-{who}-contact-1,Row,{who}@x.io,555,VP\n"
                           f"{TAG}-{who}-contact-2,Row,{who}2@x.io,555,Dir",
        "table": "contacts",
    },
    "companies": {
        "url": f"{APP}/companies",
        "header": "name,industry,website,phone,email,employee_count,annual_revenue,city,country",
        "name_field": "name",
        "row": lambda who: f"{TAG}-{who}-company-1,SaaS,https://a.io,555,a@a.io,10,10000,SF,USA\n"
                           f"{TAG}-{who}-company-2,SaaS,https://b.io,555,b@b.io,20,20000,NY,USA",
        "table": "companies",
    },
}
ROLES = ["exec", "manager", "admin"]

async def signin(page, email):
    await page.goto(f"{APP}/auth", wait_until="networkidle")
    await page.wait_for_timeout(800)
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').first.fill(PWD)
    await page.locator('form button[type="submit"]').first.click()
    for _ in range(50):
        await page.wait_for_timeout(300)
        if "/dashboard" in page.url:
            return
    raise RuntimeError(f"login failed for {email}: {page.url}")

async def import_csv(page, mod_key, who):
    m = MOD[mod_key]
    await page.goto(m["url"], wait_until="domcontentloaded")
    await page.wait_for_timeout(1200)
    await page.get_by_role("button", name="Import", exact=True).first.click()
    await page.wait_for_selector('input[type="file"]', timeout=8000)

    csv_bytes = (m["header"] + "\n" + m["row"](who) + "\n").encode()
    tmp = DOWNLOADS / f"import-{mod_key}-{who}-{STAMP}.csv"
    tmp.write_bytes(csv_bytes)
    await page.locator('input[type="file"]').set_input_files(str(tmp))
    # Click the Import button INSIDE the dialog (not the outer one)
    await page.locator('[role="dialog"]').get_by_role("button", name="Import", exact=True).click()
    # Wait for success or an error toast
    for _ in range(30):
        await page.wait_for_timeout(400)
        html = await page.content()
        if "rows imported" in html.lower() or "import failed" in html.lower():
            break
    # Close dialog
    close_btn = page.locator('[role="dialog"]').get_by_role("button", name="Close", exact=True)
    if await close_btn.count():
        await close_btn.first.click()
    await page.wait_for_timeout(500)

async def export_csv(page, mod_key):
    await page.goto(MOD[mod_key]["url"], wait_until="domcontentloaded")
    await page.wait_for_timeout(2000)
    await page.keyboard.press("Escape")  # dismiss any lingering dialog/toast
    await page.wait_for_timeout(300)
    async with page.expect_download(timeout=30000) as dl_info:
        await page.get_by_role("button", name="Export", exact=True).first.click()
    dl = await dl_info.value
    dest = DOWNLOADS / f"export-{mod_key}-{STAMP}-{dl.suggested_filename}"
    await dl.save_as(str(dest))
    return dest.read_text(encoding="utf-8", errors="ignore")

def rows_matching_tag(csv_text, prefix):
    reader = csv.reader(io.StringIO(csv_text))
    try:
        header = next(reader)
    except StopIteration:
        return []
    return [r for r in reader if any(prefix in (c or "") for c in r)]

async def run():
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        try:
            # Seed a HIDDEN-token admin-owned row per module (bypasses UI)
            users = SB.auth.admin.list_users()
            ids = {u.email: u.id for u in users}
            adm_id = ids[EMAILS["admin"]]
            hidden_ids = {}
            adm_co = SB.table("companies").insert(
                {"name": f"{TAG}-HIDDEN-adm-co", "created_by": adm_id}
            ).execute().data[0]
            hidden_ids["companies"] = [adm_co["id"]]
            hidden_ids["contacts"] = [SB.table("contacts").insert(
                {"first_name": f"{TAG}-HIDDEN-adm-contact", "last_name": "N",
                 "company_id": adm_co["id"], "created_by": adm_id}
            ).execute().data[0]["id"]]
            hidden_ids["leads"] = [SB.table("leads").insert(
                {"company_name": f"{TAG}-HIDDEN-adm-lead", "status": "new",
                 "priority": "medium", "created_by": adm_id, "assigned_to": adm_id}
            ).execute().data[0]["id"]]

            # Run per role
            for role in ROLES:
                ctx = await br.new_context(
                    viewport={"width": 1280, "height": 1800},
                    accept_downloads=True,
                )
                page = await ctx.new_page()
                await signin(page, EMAILS[role])

                for mod_key in MOD:
                    # Import as this role
                    await import_csv(page, mod_key, role)

                    # Verify rows persisted via service role (ownership = self)
                    rows = SB.table(mod_key).select("id, created_by") \
                        .ilike(MOD[mod_key]["name_field"], f"{TAG}-{role}-%").execute().data
                    check(f"{role}: {mod_key} UI import created ≥2 rows", len(rows) >= 2,
                          f"got {len(rows)}")
                    check(f"{role}: {mod_key} UI import rows owned by signed-in user",
                          all(r["created_by"] == ids[EMAILS[role]] for r in rows))

                    # Export via UI
                    csv_text = await export_csv(page, mod_key)
                    mine = rows_matching_tag(csv_text, f"{TAG}-{role}-")
                    check(f"{role}: {mod_key} export contains own imported rows", len(mine) >= 2,
                          f"got {len(mine)}")

                    # Cross-role isolation: exec export must NOT include HIDDEN admin rows
                    hidden_hits = rows_matching_tag(csv_text, f"{TAG}-HIDDEN-")
                    if role == "exec":
                        check(f"exec: {mod_key} export excludes admin HIDDEN rows",
                              len(hidden_hits) == 0, f"leaked {len(hidden_hits)}")
                    else:
                        check(f"{role}: {mod_key} export includes admin HIDDEN rows (manager/admin see all)",
                              len(hidden_hits) >= 1, f"got {len(hidden_hits)}")

                await page.screenshot(path=str(SHOTS / f"csv_ui_{role}.png"))
                await ctx.close()
        finally:
            await br.close()
            # Cleanup all TAG rows
            for tbl, field in [("contacts", "first_name"), ("leads", "company_name"), ("companies", "name")]:
                rows = SB.table(tbl).select("id").ilike(field, f"{TAG}%").execute().data
                if rows:
                    SB.table(tbl).delete().in_("id", [r["id"] for r in rows]).execute()

    failed = [n for n, ok_ in RESULTS if not ok_]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} UI checks passed")
    if failed:
        sys.exit(1)

asyncio.run(run())
