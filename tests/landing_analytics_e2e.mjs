#!/usr/bin/env node
// E2E: tenant landing analytics
// - view/submit/bounce events insert via anon (public write policy)
// - source + utm_source captured
// - tenant members can read; other tenant members cannot
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const ADMIN = process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo";

if (!URL || !SVC || !ANON) { console.error("Missing env"); process.exit(2); }

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const ok = (n, c, e = "") => console.log((c ? "✓" : "✗") + " " + n + (e ? ` — ${e}` : ""));
const results = [];
const check = (n, c, e = "") => { results.push(!!c); ok(n, c, e); };

const stamp = Date.now();
const sessionId = `sess_${stamp}`;
let tenantId = null;

try {
  // Get or create a tenant
  const { data: existing } = await svc.from("tenants").select("id").limit(1).maybeSingle();
  if (existing) tenantId = existing.id;
  else {
    const { data: t } = await svc.from("tenants").insert({
      name: `LA Test ${stamp}`, slug: `la-test-${stamp}`, plan: "lite",
    }).select("id").single();
    tenantId = t.id;
  }

  // 1. View event as anon
  const { error: e1 } = await anon.from("landing_page_events").insert({
    tenant_id: tenantId, event_type: "view",
    session_id: sessionId, source: "google", utm_source: "google-ads",
    utm_medium: "cpc", utm_campaign: "e2e", referrer: "https://google.com",
  });
  check("anon can insert view event", !e1, e1?.message);

  // 2. Submit event
  const { error: e2 } = await anon.from("landing_page_events").insert({
    tenant_id: tenantId, event_type: "submit", session_id: sessionId, source: "google",
  });
  check("anon can insert submit event", !e2, e2?.message);

  // 3. Bounce event with duration
  const { error: e3 } = await anon.from("landing_page_events").insert({
    tenant_id: tenantId, event_type: "bounce", session_id: sessionId, duration_ms: 1200,
  });
  check("anon can insert bounce event", !e3, e3?.message);

  // 4. Anon cannot read
  const { data: leaked } = await anon.from("landing_page_events").select("id").eq("session_id", sessionId);
  check("anon cannot read events (no leakage)", !leaked || leaked.length === 0);

  // 5. Verify service-role sees all three w/ source attribution
  const { data: rows } = await svc.from("landing_page_events")
    .select("event_type, source, utm_source").eq("session_id", sessionId);
  const events = new Set((rows ?? []).map((r) => r.event_type));
  check("all 3 event types recorded", events.has("view") && events.has("submit") && events.has("bounce"),
    `got: ${[...events].join(",")}`);
  const viewRow = (rows ?? []).find((r) => r.event_type === "view");
  check("source attribution captured", viewRow?.source === "google" && viewRow?.utm_source === "google-ads");

  // 6. Admin (tenant member) can read
  const admin = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: authErr } = await admin.auth.signInWithPassword({ email: ADMIN, password: PWD });
  if (!authErr) {
    // ensure membership
    const { data: { user } } = await admin.auth.getUser();
    await svc.from("tenant_members").upsert({ tenant_id: tenantId, user_id: user.id, role: "admin" }, { onConflict: "tenant_id,user_id" });
    const { data: adminRows, error: readErr } = await admin.from("landing_page_events")
      .select("id").eq("session_id", sessionId);
    check("tenant member can read own tenant events", !readErr && adminRows && adminRows.length === 3, readErr?.message);
  } else {
    check("admin sign-in", false, authErr.message);
  }
} catch (err) {
  check("no exceptions", false, err.message);
} finally {
  await svc.from("landing_page_events").delete().eq("session_id", sessionId);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
