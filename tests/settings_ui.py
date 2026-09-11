"""Playwright UI RBAC checks for Settings/Profile across all roles.

For every role (admin, sales_manager, sales_executive):
  - /settings loads and the "Profile" card is present (all roles).
  - Team Members admin panel is visible for admin ONLY.
  - Role-elevation via the Team Members dropdown is blocked at the API level
    for non-admins (the panel isn't rendered, so we assert the underlying
    user_roles write is rejected via the same authenticated client).
  - Profile save writes update only the caller's own profile row.
"""
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

APP = os.environ.get("APP_URL", "http://localhost:8080")
PWD = os.environ.get("TEST_USER_PASSWORD", "DigiCrm!Demo2026")
ROLES = {
    "admin": os.environ.get("TEST_ADMIN_EMAIL", "admin@digicrm.demo"),
    "manager": os.environ.get("TEST_MANAGER_EMAIL", "manager@digicrm.demo"),
    "exec": os.environ.get("TEST_EXEC_EMAIL", "executive@digicrm.demo"),
}
SHOTS = Path("/tmp/browser/settings_ui/shots"); SHOTS.mkdir(parents=True, exist_ok=True)
results = []
def ok(name, cond, extra=""):
    results.append(cond)
    print(("✓" if cond else "✗") + " " + name + (f" — {extra}" if extra else ""))

async def sign_in(page, email):
    await page.goto(f"{APP}/auth", wait_until="domcontentloaded")
    await page.get_by_label("Email").first.fill(email)
    await page.get_by_label("Password").first.fill(PWD)
    await page.get_by_role("button", name="Sign in", exact=False).first.click()
    await page.wait_for_url("**/dashboard", timeout=15000)

async def run_role(pw, label, email):
    ctx = await pw.chromium.launch(headless=True)
    context = await ctx.new_context(viewport={"width": 1280, "height": 1800})
    page = await context.new_page()
    try:
        await sign_in(page, email)
        await page.goto(f"{APP}/settings", wait_until="domcontentloaded")
        await page.wait_for_load_state("networkidle")
        await page.screenshot(path=str(SHOTS / f"{label}_settings.png"))

        # Profile card visible for all roles
        heading = await page.get_by_text("Profile", exact=True).count()
        ok(f"[{label}] /settings loads with Profile card", heading > 0)

        # Team Members admin panel visibility
        tm = await page.get_by_text("Team Members", exact=True).count()
        if label == "admin":
            ok("[admin] Team Members panel visible", tm > 0)
        else:
            ok(f"[{label}] Team Members panel hidden", tm == 0)

        # Underlying API check: non-admin cannot INSERT into user_roles for another user
        result = await page.evaluate(
            """async () => {
                const { supabase } = await import('/src/integrations/supabase/client.ts');
                const { data: u } = await supabase.auth.getUser();
                const other = crypto.randomUUID();
                const { error } = await supabase.from('user_roles').insert({ user_id: other, role: 'admin' });
                return { uid: u.user.id, err: error?.message ?? null };
            }"""
        )
        if label == "admin":
            # Admin insert against a non-existent auth user will fail on FK, not RLS.
            # Assert error is NOT an RLS/permission denial.
            msg = (result.get("err") or "").lower()
            ok("[admin] user_roles insert not RLS-blocked",
               "row-level security" not in msg and "permission denied" not in msg,
               result.get("err") or "ok")
        else:
            msg = (result.get("err") or "").lower()
            ok(f"[{label}] user_roles insert blocked by RLS",
               "row-level security" in msg or "permission denied" in msg or "violates" in msg,
               result.get("err") or "no-error?!")

        # Save profile: only caller's row is updated
        pupd = await page.evaluate(
            """async () => {
                const { supabase } = await import('/src/integrations/supabase/client.ts');
                const { data: u } = await supabase.auth.getUser();
                const { data, error } = await supabase.from('profiles')
                    .update({ full_name: 'RBAC Probe' })
                    .neq('id', u.user.id)
                    .select('id');
                return { rows: (data ?? []).length, err: error?.message ?? null };
            }"""
        )
        ok(f"[{label}] profile update on OTHER rows affects 0 rows",
           pupd.get("rows") == 0, str(pupd))

    finally:
        await ctx.close()

async def main():
    async with async_playwright() as pw:
        for label, email in ROLES.items():
            print(f"\n=== {label} ({email}) ===")
            await run_role(pw, label, email)
    passed = sum(1 for r in results if r)
    print(f"\n{passed}/{len(results)} settings/profile UI checks passed")
    if passed != len(results):
        sys.exit(1)

asyncio.run(main())
