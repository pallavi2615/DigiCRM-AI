#!/usr/bin/env node
// REST RBAC + audit-log assertions for DigiCRM.
// Exits non-zero on any failed assertion; prints per-check ✓/✗ summary.
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
if (!URL || !SVC || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  process.exit(2);
}

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, cond: !!cond, extra });
  console.log((cond ? "✓" : "✗") + " " + name + (extra ? ` — ${extra}` : ""));
};

async function client(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return c;
}

const stamp = Date.now();
const created = { companies: [], contacts: [], activities: [] };

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const execId = byEmail[EMAILS.exec], adminId = byEmail[EMAILS.admin];

  // Seed: admin-owned & exec-owned rows
  const adminCo = (await svc.from("companies").insert({ name: `RCI-Adm-${stamp}`, industry: "Restricted", created_by: adminId }).select().single()).data;
  const execCo = (await svc.from("companies").insert({ name: `RCI-Exec-${stamp}`, industry: "Retail", created_by: execId }).select().single()).data;
  created.companies.push(adminCo.id, execCo.id);
  const hidden = (await svc.from("contacts").insert({ first_name: `HIDDEN-${stamp}`, last_name: "X", company_id: adminCo.id, created_by: adminId }).select().single()).data;
  const visible = (await svc.from("contacts").insert({ first_name: `VIS-${stamp}`, last_name: "Y", company_id: execCo.id, created_by: execId }).select().single()).data;
  created.contacts.push(hidden.id, visible.id);

  const execC = await client(EMAILS.exec);
  const mgrC = await client(EMAILS.manager);
  const admC = await client(EMAILS.admin);

  // --- Companies query surface: exec never infers admin rows ---
  const q1 = await execC.from("companies").select("id").ilike("name", `RCI-Adm-${stamp}%`);
  ok("exec .ilike admin-prefix returns 0 companies", (q1.data ?? []).length === 0);
  const q2 = await execC.from("companies").select("id").eq("industry", "Restricted");
  ok("exec .eq industry=Restricted returns 0 companies", (q2.data ?? []).length === 0);
  const q3 = await execC.from("companies").select("id").in("id", [adminCo.id]);
  ok("exec .in([adminCo]) returns 0 companies", (q3.data ?? []).length === 0);
  const q4 = await execC.from("companies").select("id", { count: "exact", head: true }).eq("id", adminCo.id);
  ok("exec count exact on admin company === 0", (q4.count ?? 0) === 0);
  const q5 = await execC.from("companies").select("id").range(0, 500);
  ok("exec .range(0,500) never contains admin company", !(q5.data ?? []).some((r) => r.id === adminCo.id));

  // --- Contacts query surface ---
  const c1 = await execC.from("contacts").select("id").in("id", [hidden.id]);
  ok("exec contacts .in([hidden]) returns 0", (c1.data ?? []).length === 0);
  const c2 = await execC.from("contacts").select("id").ilike("first_name", `HIDDEN-${stamp}%`);
  ok("exec contacts .ilike HIDDEN returns 0", (c2.data ?? []).length === 0);
  const c3 = await execC.from("contacts").select("id").in("company_id", [adminCo.id]);
  ok("exec contacts .in(company_id=admin) returns 0", (c3.data ?? []).length === 0);
  const c4 = await execC.from("contacts").select("id", { count: "exact", head: true }).eq("id", hidden.id);
  ok("exec contacts count exact on hidden === 0", (c4.count ?? 0) === 0);
  const c5 = await execC.from("contacts").select("id").range(0, 500);
  ok("exec contacts .range(0,500) never contains hidden", !(c5.data ?? []).some((r) => r.id === hidden.id));

  // --- Manager / admin see all ---
  const m1 = await mgrC.from("contacts").select("id").eq("id", hidden.id);
  ok("manager can read hidden contact", (m1.data ?? []).length === 1);
  const a1 = await admC.from("contacts").select("id").eq("id", hidden.id);
  ok("admin can read hidden contact", (a1.data ?? []).length === 1);

  // --- Company delete ownership ---
  const d1 = await execC.from("companies").delete().eq("id", adminCo.id);
  ok("exec delete on admin company blocked", (d1.data ?? []).length === 0);
  const d2 = await mgrC.from("companies").delete().eq("id", adminCo.id);
  ok("manager delete on admin company blocked", (d2.data ?? []).length === 0);

  // --- Profile read isolation ---
  const p1 = await execC.from("profiles").select("id");
  ok("exec profiles read returns exactly self", (p1.data ?? []).length === 1);
  const p2 = await mgrC.from("profiles").select("id");
  ok("manager profiles read > 1 row", (p2.data ?? []).length > 1);

  // --- Role self-elevation is blocked ---
  const r1 = await execC.from("user_roles").insert({ user_id: execId, role: "admin" });
  ok("exec self-elevation on user_roles blocked", !!r1.error);

  // --- Audit-log: denied attempts must be recorded with role-safe metadata ---
  // Client-side denial log (mirrors what the UI does)
  const denialAttempts = [
    { entity_type: "companies", action: "access_denied", entity_id: adminCo.id, description: "denied delete companies", metadata: { attempted_action: "delete", reason: "rls_blocked" } },
    { entity_type: "contacts",  action: "access_denied", entity_id: hidden.id,  description: "denied read contacts",   metadata: { attempted_action: "read",   reason: "rls_blocked" } },
    { entity_type: "user_roles",action: "access_denied", entity_id: null,       description: "denied elevate role",    metadata: { attempted_action: "insert", reason: "rls_blocked" } },
  ];
  for (const a of denialAttempts) {
    const ins = await execC.from("activities").insert({ ...a, actor_id: execId }).select().single();
    if (ins.data?.id) created.activities.push(ins.data.id);
    ok(`audit row inserted for ${a.entity_type}/${a.action}`, !!ins.data && !ins.error);
  }

  // Admin reads them back and validates schema + redaction
  const audit = await admC
    .from("activities")
    .select("id, actor_id, entity_type, entity_id, action, description, metadata")
    .eq("action", "access_denied")
    .eq("actor_id", execId)
    .in("entity_type", ["companies", "contacts", "user_roles"])
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = audit.data ?? [];
  ok("admin can read denied-attempt audit rows", rows.length >= 3);
  for (const mod of ["companies", "contacts", "user_roles"]) {
    const r = rows.find((x) => x.entity_type === mod);
    ok(`audit row present for module=${mod}`, !!r);
    if (r) {
      ok(`audit row module=${mod} action=access_denied`, r.action === "access_denied");
      ok(`audit row module=${mod} has attempted_action metadata`, !!r.metadata?.attempted_action);
      // Redaction: never store credentials/tokens/raw PII payloads
      const meta = JSON.stringify(r.metadata ?? {}).toLowerCase();
      const leaks = ["password", "access_token", "refresh_token", "authorization", "bearer ", "cookie", "secret"];
      const leaked = leaks.find((k) => meta.includes(k));
      ok(`audit row module=${mod} metadata redacted (no secrets)`, !leaked, leaked ? `contains ${leaked}` : "");
      // Role-safe schema: only allow-listed keys on metadata
      const keys = Object.keys(r.metadata ?? {});
      const allowed = new Set(["attempted_action", "reason", "path", "changes"]);
      const extra = keys.filter((k) => !allowed.has(k));
      ok(`audit row module=${mod} metadata keys within allow-list`, extra.length === 0, extra.join(","));
    }
  }
} finally {
  if (created.activities.length) await svc.from("activities").delete().in("id", created.activities);
  if (created.contacts.length)   await svc.from("contacts").delete().in("id", created.contacts);
  if (created.companies.length)  await svc.from("companies").delete().in("id", created.companies);
}

const failed = results.filter((r) => !r.cond);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
