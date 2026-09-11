"""Playwright UI smoke — /contacts pagination never leaks unauthorized rows.

Signs in as Sales Executive, seeds 25 admin-owned hidden contacts + 3 exec-owned
visible contacts, then walks every page size and every page to assert:
  * No table row exposes a hidden contact's DOM (id, name).
  * page-info total matches the executive-visible count only.
  * Search over a hidden token returns zero rows on every page size.
Then signs in as Admin to confirm the hidden contacts DO render.
"""
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright
from supabase import create_client

URL  = os.environ["SUPABASE_URL"]
SVC  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
APP  = os.environ.get("APP_URL", "http://localhost:8080")
PWD  = os.environ.get("TEST_USER_PASSWORD", "DigiCrm!Demo2026")
EXEC = os.environ.get("TEST_EXEC_EMAIL", "executive@digicrm.demo")
ADM  = os.environ.get("TEST_ADMIN_EMAIL", "admin@digicrm.demo")

SB = create_client(URL, SVC)
SHOTS = Path("tests/.artifacts"); SHOTS.mkdir(parents=True, exist_ok=True)

results = []
def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("✓" if cond else "✗"), name, ("— " + extra) if extra else "")

async def signin(page, email):
    await page.goto(f"{APP}/auth", wait_until="networkidle")
    await page.wait_for_timeout(1000)
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').first.fill(PWD)
    await page.locator('form button[type="submit"]').first.click()
    for _ in range(40):
        await page.wait_for_timeout(400)
        if "/dashboard" in page.url:
            return
    raise RuntimeError(f"login failed: {page.url}")

async def contact_row_ids(page):
    return await page.locator('[data-testid="contact-row"]').evaluate_all(
        "els => els.map(e => e.getAttribute('data-contact-id'))"
    )

async def run():
    users = SB.auth.admin.list_users()
    ids = {u.email: u.id for u in users}
    exec_id, adm_id = ids[EXEC], ids[ADM]

    stamp = int(asyncio.get_event_loop().time() * 1000)
    HIDDEN_TOKEN = f"HIDDENPG{stamp}"
    VISIBLE_TOKEN = f"VISPG{stamp}"

    adm_co  = SB.table("companies").insert({"name": f"PG-Adm-{stamp}", "created_by": adm_id}).execute().data[0]
    exec_co = SB.table("companies").insert({"name": f"PG-Exec-{stamp}", "created_by": exec_id}).execute().data[0]

    hidden_rows = SB.table("contacts").insert([
        {"first_name": f"{HIDDEN_TOKEN}-{i:02d}", "last_name": "Nope",
         "company_id": adm_co["id"], "created_by": adm_id}
        for i in range(25)
    ]).execute().data
    visible_rows = SB.table("contacts").insert([
        {"first_name": f"{VISIBLE_TOKEN}-{i}", "last_name": "Ok",
         "company_id": exec_co["id"], "created_by": exec_id}
        for i in range(3)
    ]).execute().data
    hidden_ids = {r["id"] for r in hidden_rows}

    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        try:
            # ---- Executive ----
            ctx = await br.new_context(viewport={"width": 1280, "height": 1800})
            page = await ctx.new_page()
            await signin(page, EXEC)
            await page.goto(f"{APP}/contacts", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="contacts-table-wrap"]', timeout=15000)
            await page.wait_for_timeout(1500)

            info = (await page.locator('[data-testid="contacts-page-info"]').inner_text()).lower()
            check("exec page-info total excludes hidden contacts",
                  "3 total" in info or "· 3 " in info, info)

            for size in ["5", "10", "25", "50"]:
                # open the page-size Select and pick the option
                await page.locator('[data-testid="contacts-page-size"]').click()
                await page.get_by_role("option", name=size, exact=True).click()
                await page.wait_for_timeout(500)

                # Walk every page and ensure no hidden id/name ever renders
                seen_bad_ids = set()
                seen_bad_text = False
                for _ in range(20):
                    row_ids = set(await contact_row_ids(page))
                    seen_bad_ids |= (row_ids & hidden_ids)
                    html = await page.content()
                    if HIDDEN_TOKEN in html:
                        seen_bad_text = True
                    nxt = page.locator('[data-testid="contacts-next"]')
                    if await nxt.is_disabled():
                        break
                    await nxt.click()
                    await page.wait_for_timeout(300)

                check(f"exec pageSize={size}: no hidden contact-id ever rendered", not seen_bad_ids,
                      ",".join(list(seen_bad_ids)[:3]))
                check(f"exec pageSize={size}: no hidden token text ever in DOM", not seen_bad_text)

                # Reset page to 1 for next size
                await page.locator('[data-testid="contacts-page-size"]').click()
                await page.get_by_role("option", name=size, exact=True).click()
                await page.wait_for_timeout(200)

            # Search assertion at page size 50
            await page.locator('[data-testid="contacts-page-size"]').click()
            await page.get_by_role("option", name="50", exact=True).click()
            search = page.locator('input[placeholder*="Search"]').first
            await search.fill(HIDDEN_TOKEN)
            await page.wait_for_timeout(1500)
            n = await page.locator(f'tbody tr:has-text("{HIDDEN_TOKEN}")').count()
            check("exec search on hidden token yields 0 rows", n == 0)
            await page.screenshot(path=str(SHOTS / "exec_contacts_pagination.png"))
            await ctx.close()

            # ---- Admin sees hidden rows ----
            ctx = await br.new_context(viewport={"width": 1280, "height": 1800})
            page = await ctx.new_page()
            await signin(page, ADM)
            await page.goto(f"{APP}/contacts", wait_until="domcontentloaded")
            await page.wait_for_selector('[data-testid="contacts-table-wrap"]', timeout=15000)
            await page.locator('[data-testid="contacts-page-size"]').click()
            await page.get_by_role("option", name="50", exact=True).click()
            search = page.locator('input[placeholder*="Search"]').first
            await search.fill(HIDDEN_TOKEN)
            await page.wait_for_timeout(1500)
            n = await page.locator(f'tbody tr:has-text("{HIDDEN_TOKEN}")').count()
            check("admin search on hidden token yields >= 1 row", n >= 1)
            await page.screenshot(path=str(SHOTS / "admin_contacts_pagination.png"))
        finally:
            await br.close()
            SB.table("contacts").delete().in_("id", [r["id"] for r in hidden_rows + visible_rows]).execute()
            SB.table("companies").delete().in_("id", [adm_co["id"], exec_co["id"]]).execute()

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} UI checks passed")
    if failed:
        sys.exit(1)

asyncio.run(run())
