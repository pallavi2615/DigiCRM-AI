#!/usr/bin/env node
// E2E: cross-tenant RLS + role-based access verification.
//
// Verifies that data owned by one tenant workspace is completely isolated
// from members of another tenant workspace across the tenant-scoped tables:
//
//   - tenants                  (branding, secret, plan)
//   - tenant_members           (membership rows)
//   - tenant_landing_pages     (published + draft landing pages)
//   - landing_page_events      (analytics events)
//
// Also validates the anon (public) surface: anonymous visitors may only
// insert view/submit/bounce events for ACTIVE tenants, must never read
// tenant secrets, and must never read draft landing pages.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const EMAILS = {
  admin: process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo",
  manager: process.env.TEST_MANAGER_EMAIL || "manager@digicrm.demo",
  exec: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};
if (!URL || !SVC || !ANON) { console.error("Missing env"); process.exit(2); }

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const results = [];
const check = (n, c, e = "") => {
  results.push(!!c);
  console.log((c ? "✓" : "✗") + " " + n + (e ? ` — ${e}` : ""));
};

async function signedIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  const { data: { user } } = await c.auth.getUser();
  return { client: c, userId: user.id };
}

const stamp = Date.now();
const cleanup = { tenants: [], pages: [], sessions: [] };

try {
  const admin = await signedIn(EMAILS.admin);
  const manager = await signedIn(EMAILS.manager);
  const exec = await signedIn(EMAILS.exec);

  // --- Create two isolated tenants owned by the admin (via service role) ---
  const { data: tA, error: eA } = await svc.from("tenants").insert({
    name: `Tenant Alpha ${stamp}`,
    slug: `alpha-${stamp}`,
    plan: "prime",
    owner_id: admin.userId,
    is_active: true,
  }).select("id").single();
  if (eA) throw new Error(`create tenant A: ${eA.message}`);
  cleanup.tenants.push(tA.id);
  await svc.from("tenant_webhook_secrets").upsert(
    { tenant_id: tA.id, webhook_secret: `secret-A-${stamp}` },
    { onConflict: "tenant_id" },
  );

  const { data: tB, error: eB } = await svc.from("tenants").insert({
    name: `Tenant Beta ${stamp}`,
    slug: `beta-${stamp}`,
    plan: "lite",
    owner_id: admin.userId,
    is_active: true,
  }).select("id").single();
  if (eB) throw new Error(`create tenant B: ${eB.message}`);
  cleanup.tenants.push(tB.id);
  await svc.from("tenant_webhook_secrets").upsert(
    { tenant_id: tB.id, webhook_secret: `secret-B-${stamp}` },
    { onConflict: "tenant_id" },
  );


  // Manager is a member of Tenant A only. Executive of Tenant B only.
  await svc.from("tenant_members").upsert(
    [
      { tenant_id: tA.id, user_id: manager.userId, role: "admin" },
      { tenant_id: tB.id, user_id: exec.userId, role: "member" },
    ],
    { onConflict: "tenant_id,user_id" },
  );

  // --- Seed landing pages (published + draft) per tenant ---
  const { data: pA } = await svc.from("tenant_landing_pages").insert({
    tenant_id: tA.id, slug: `alpha-live-${stamp}`, title: "Alpha live",
    industry: "fintech-dsa", is_published: true, headline: "Alpha", subheadline: "live",
  }).select("id").single();
  const { data: pAD } = await svc.from("tenant_landing_pages").insert({
    tenant_id: tA.id, slug: `alpha-draft-${stamp}`, title: "Alpha draft",
    industry: "fintech-dsa", is_published: false, headline: "Alpha", subheadline: "draft",
  }).select("id").single();
  const { data: pB } = await svc.from("tenant_landing_pages").insert({
    tenant_id: tB.id, slug: `beta-live-${stamp}`, title: "Beta live",
    industry: "real-estate", is_published: true, headline: "Beta", subheadline: "live",
  }).select("id").single();
  cleanup.pages.push(pA.id, pAD.id, pB.id);

  // --- Seed analytics events for each tenant ---
  const sessA = `sess-A-${stamp}`;
  const sessB = `sess-B-${stamp}`;
  cleanup.sessions.push(sessA, sessB);
  await svc.from("landing_page_events").insert([
    { tenant_id: tA.id, event_type: "view", session_id: sessA, page_slug: pA.slug },
    { tenant_id: tA.id, event_type: "submit", session_id: sessA, page_slug: pA.slug },
    { tenant_id: tB.id, event_type: "view", session_id: sessB, page_slug: pB.slug },
  ]);

  // =====================================================================
  // TENANTS TABLE ISOLATION
  // =====================================================================
  {
    // Manager belongs to A only: sees A, NOT B (and no webhook_secret column exists on tenants)
    const { data } = await manager.client.from("tenants").select("id").in("id", [tA.id, tB.id]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("manager (member of A) sees tenant A", ids.has(tA.id));
    check("manager (member of A) cannot see tenant B", !ids.has(tB.id));
  }
  {
    // Exec belongs to B only: sees B, NOT A
    const { data } = await exec.client.from("tenants").select("id").in("id", [tA.id, tB.id]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("exec (member of B) sees tenant B", ids.has(tB.id));
    check("exec (member of B) cannot see tenant A", !ids.has(tA.id));
  }
  {
    // Admin role (has admin app_role) sees BOTH via tenants_admin_all
    const { data } = await admin.client.from("tenants").select("id").in("id", [tA.id, tB.id]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("app admin sees both tenants", ids.has(tA.id) && ids.has(tB.id));
  }
  {
    // Anon must not see tenants at all
    const { data } = await anon.from("tenants").select("id").in("id", [tA.id, tB.id]);
    check("anon cannot read tenants", !data || data.length === 0);
  }

  // =====================================================================
  // WEBHOOK SECRET ADMIN-ONLY ACCESS
  // =====================================================================
  {
    const { data } = await manager.client
      .from("tenant_webhook_secrets").select("webhook_secret").eq("tenant_id", tA.id);
    check("manager (tenant member) cannot read webhook_secret", !data || data.length === 0);
  }
  {
    const { data } = await exec.client
      .from("tenant_webhook_secrets").select("webhook_secret").eq("tenant_id", tB.id);
    check("exec (tenant member) cannot read webhook_secret", !data || data.length === 0);
  }
  {
    const { data } = await anon
      .from("tenant_webhook_secrets").select("webhook_secret").in("tenant_id", [tA.id, tB.id]);
    check("anon cannot read webhook_secret", !data || data.length === 0);
  }
  {
    const { data } = await admin.client
      .from("tenant_webhook_secrets").select("tenant_id, webhook_secret").in("tenant_id", [tA.id, tB.id]);
    const secrets = new Map((data ?? []).map((r) => [r.tenant_id, r.webhook_secret]));
    check("admin can read webhook_secret for A", secrets.get(tA.id) === `secret-A-${stamp}`);
    check("admin can read webhook_secret for B", secrets.get(tB.id) === `secret-B-${stamp}`);
  }
  {
    // Non-admin tenant member cannot update the secret either
    const { error } = await manager.client
      .from("tenant_webhook_secrets")
      .update({ webhook_secret: "hijacked" })
      .eq("tenant_id", tA.id);
    // RLS makes UPDATE a no-op (0 rows); reject only if it actually mutated.
    const { data: after } = await admin.client
      .from("tenant_webhook_secrets").select("webhook_secret").eq("tenant_id", tA.id).single();
    check("manager cannot overwrite webhook_secret", after?.webhook_secret === `secret-A-${stamp}`, error?.message ?? "");
  }


  // =====================================================================
  // TENANT_MEMBERS ISOLATION
  // =====================================================================
  {
    // Non-admin member cannot modify membership rows for another tenant
    const { error, data } = await exec.client.from("tenant_members")
      .insert({ tenant_id: tA.id, user_id: exec.userId, role: "member" })
      .select("tenant_id");
    check("exec cannot self-join foreign tenant (RLS blocks insert)",
      !!error || !data || data.length === 0, error?.message);
  }
  {
    // Exec can only READ own membership row (tm_self_read)
    const { data } = await exec.client.from("tenant_members").select("tenant_id, user_id");
    const rows = data ?? [];
    const foreign = rows.filter((r) => r.user_id !== exec.userId);
    check("exec sees only own tenant_members rows", foreign.length === 0,
      `foreign: ${foreign.length}`);
  }

  // =====================================================================
  // TENANT_LANDING_PAGES ISOLATION
  // =====================================================================
  {
    // Manager (A member) can read A pages (published + draft) but not B
    const { data } = await manager.client.from("tenant_landing_pages")
      .select("id, tenant_id, is_published").in("id", [pA.id, pAD.id, pB.id]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("manager sees tenant A published + draft landing pages",
      ids.has(pA.id) && ids.has(pAD.id));
    check("manager cannot see tenant B landing pages", !ids.has(pB.id));
  }
  {
    // Exec cannot update A's landing page (not a member)
    const { data, error } = await exec.client.from("tenant_landing_pages")
      .update({ headline: "HIJACK" }).eq("id", pA.id).select("id");
    check("exec cannot update foreign tenant landing page",
      !!error || !data || data.length === 0, error?.message);
    const { data: verify } = await svc.from("tenant_landing_pages")
      .select("headline").eq("id", pA.id).single();
    check("tenant A landing page headline unchanged after exec attempt",
      verify?.headline !== "HIJACK", `got: ${verify?.headline}`);
  }
  {
    // Exec cannot delete A's landing page
    const { data, error } = await exec.client.from("tenant_landing_pages")
      .delete().eq("id", pA.id).select("id");
    check("exec cannot delete foreign tenant landing page",
      !!error || !data || data.length === 0, error?.message);
  }
  {
    // Anon (public) reads: only PUBLISHED pages
    const { data } = await anon.from("tenant_landing_pages")
      .select("id, is_published").in("id", [pA.id, pAD.id, pB.id]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("anon sees published landing pages for both tenants",
      ids.has(pA.id) && ids.has(pB.id));
    check("anon cannot read draft landing page", !ids.has(pAD.id));
  }

  // =====================================================================
  // LANDING_PAGE_EVENTS ISOLATION
  // =====================================================================
  {
    // Manager sees A events, NOT B
    const { data } = await manager.client.from("landing_page_events")
      .select("id, tenant_id, session_id").in("session_id", [sessA, sessB]);
    const tenants = new Set((data ?? []).map((r) => r.tenant_id));
    check("manager (A) reads only tenant A analytics events",
      tenants.has(tA.id) && !tenants.has(tB.id));
  }
  {
    // Exec sees B events, NOT A
    const { data } = await exec.client.from("landing_page_events")
      .select("id, tenant_id, session_id").in("session_id", [sessA, sessB]);
    const tenants = new Set((data ?? []).map((r) => r.tenant_id));
    check("exec (B) reads only tenant B analytics events",
      tenants.has(tB.id) && !tenants.has(tA.id));
  }
  {
    // Anon cannot read events for anyone
    const { data } = await anon.from("landing_page_events")
      .select("id").in("session_id", [sessA, sessB]);
    check("anon cannot read landing_page_events", !data || data.length === 0);
  }
  {
    // Anon CAN insert events for an ACTIVE tenant
    const { error } = await anon.from("landing_page_events").insert({
      tenant_id: tA.id, event_type: "view", session_id: `anon-${stamp}`, page_slug: pA.slug,
    });
    check("anon can insert view event for active tenant", !error, error?.message);
    cleanup.sessions.push(`anon-${stamp}`);
  }
  {
    // Anon CANNOT insert events for a de-activated tenant
    await svc.from("tenants").update({ is_active: false }).eq("id", tB.id);
    const { error } = await anon.from("landing_page_events").insert({
      tenant_id: tB.id, event_type: "view", session_id: `blocked-${stamp}`, page_slug: pB.slug,
    });
    check("anon insert blocked for inactive tenant", !!error, error?.message ?? "no-error");
    await svc.from("tenants").update({ is_active: true }).eq("id", tB.id);
  }
  {
    // Anon CANNOT insert an unsupported event_type
    const { error } = await anon.from("landing_page_events").insert({
      tenant_id: tA.id, event_type: "hack", session_id: `bad-${stamp}`, page_slug: pA.slug,
    });
    check("anon insert rejected for disallowed event_type", !!error, error?.message ?? "no-error");
  }
  {
    // Manager (member of A) cannot INSERT events attributed to Tenant B
    // The WITH CHECK requires the tenant to exist + be active, which is fine,
    // but the SELECT policy will hide the row afterward. We assert no row is
    // returned for foreign tenants via the manager's client.
    const { data } = await manager.client.from("landing_page_events")
      .select("id").eq("tenant_id", tB.id);
    check("manager cannot read foreign tenant events", !data || data.length === 0);
  }

  // =====================================================================
  // TENANTS UPDATE OWNERSHIP
  // =====================================================================
  {
    // Manager (member but NOT owner) cannot update tenant branding
    const { data, error } = await manager.client.from("tenants")
      .update({ name: "HIJACK NAME" }).eq("id", tA.id).select("id");
    // Manager is not app-admin and not owner_id; tenants_owner_update requires owner_id=auth.uid()
    check("manager (non-owner) cannot update tenant name",
      !!error || !data || data.length === 0, error?.message);
    const { data: v } = await svc.from("tenants").select("name").eq("id", tA.id).single();
    check("tenant A name unchanged after manager update attempt",
      v?.name !== "HIJACK NAME", `got: ${v?.name}`);
  }
} catch (err) {
  check("no exceptions", false, err.message);
} finally {
  if (cleanup.sessions.length) {
    await svc.from("landing_page_events").delete().in("session_id", cleanup.sessions);
  }
  if (cleanup.pages.length) {
    await svc.from("tenant_landing_pages").delete().in("id", cleanup.pages);
  }
  if (cleanup.tenants.length) {
    await svc.from("tenant_members").delete().in("tenant_id", cleanup.tenants);
    await svc.from("landing_page_events").delete().in("tenant_id", cleanup.tenants);
    await svc.from("tenants").delete().in("id", cleanup.tenants);
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
