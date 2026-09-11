#!/usr/bin/env node
// CSV import/export RBAC checks for leads/contacts/companies.
// - "Import" == authenticated bulk INSERT (what CsvImportDialog does).
// - "Export" == authenticated SELECT (what the Export button serializes).
// Verifies per-role ownership enforcement and cross-role export isolation.
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
  results.push({ name, cond: !!cond });
  console.log((cond ? "✓" : "✗") + " " + name + (extra ? ` — ${extra}` : ""));
};

async function client(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return c;
}

const stamp = Date.now();
const cleanup = { leads: [], contacts: [], companies: [] };

// One row of what the CSV import path would produce (created_by injected client-side).
function row(entity, owner, tag) {
  if (entity === "companies")
    return { name: `CSV-${tag}-${stamp}`, industry: "CSV", created_by: owner };
  if (entity === "contacts")
    return { first_name: `CSV-${tag}-${stamp}`, last_name: "Row", created_by: owner };
  return { company_name: `CSV-${tag}-${stamp}`, status: "new", priority: "medium", created_by: owner };
}

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const execId = byEmail[EMAILS.exec];
  const mgrId = byEmail[EMAILS.manager];
  const admId = byEmail[EMAILS.admin];

  const execC = await client(EMAILS.exec);
  const mgrC = await client(EMAILS.manager);
  const admC = await client(EMAILS.admin);

  const roles = [
    ["exec", execC, execId],
    ["manager", mgrC, mgrId],
    ["admin", admC, admId],
  ];
  const entities = ["companies", "contacts", "leads"];

  // --- Ownership: every role can import rows they own; cannot spoof created_by ---
  for (const entity of entities) {
    for (const [rname, c, uid] of roles) {
      const own = await c.from(entity).insert(row(entity, uid, `${rname}-own`)).select().single();
      ok(`${rname} CSV import ${entity} with own created_by succeeds`, !own.error && !!own.data?.id, own.error?.message);
      if (own.data?.id) cleanup[entity].push(own.data.id);

      // Spoof: try to import a row claiming another user owns it (admin id for non-admin, exec id for admin)
      const spoofOwner = rname === "admin" ? execId : admId;
      const spoof = await c.from(entity).insert(row(entity, spoofOwner, `${rname}-spoof`));
      ok(`${rname} CSV import ${entity} spoofing created_by blocked`, !!spoof.error, spoof.error?.message ?? "no error");
    }
  }

  // --- Round-trip: CSV "export" for exec returns only rows exec is allowed to read ---
  for (const entity of entities) {
    const list = await execC.from(entity).select("id, created_by").ilike(entity === "companies" ? "name" : entity === "contacts" ? "first_name" : "company_name", `CSV-%-${stamp}`);
    const bad = (list.data ?? []).filter((r) => r.created_by && r.created_by !== execId);
    // For leads/companies/contacts, exec should never see admin-owned CSV rows.
    ok(`exec CSV export of ${entity} excludes non-exec created_by rows`, bad.length === 0, bad.map((b) => b.id).slice(0, 3).join(","));
  }

  // --- Cross-role export: admin sees rows exec imported ---
  for (const entity of entities) {
    const rows = await admC.from(entity).select("id, created_by").ilike(entity === "companies" ? "name" : entity === "contacts" ? "first_name" : "company_name", `CSV-exec-own-${stamp}`);
    ok(`admin CSV export of ${entity} includes exec-imported row`, (rows.data ?? []).some((r) => r.created_by === execId));
  }

  // --- Manager export sees all non-executive rows too (companies/contacts read policy) ---
  for (const entity of ["companies", "contacts"]) {
    const rows = await mgrC.from(entity).select("id, created_by").ilike(entity === "companies" ? "name" : "first_name", `CSV-admin-own-${stamp}`);
    ok(`manager CSV export of ${entity} includes admin-owned row`, (rows.data ?? []).some((r) => r.created_by === admId));
  }
} finally {
  for (const [t, ids] of Object.entries(cleanup)) if (ids.length) await svc.from(t).delete().in("id", ids);
}

const failed = results.filter((r) => !r.cond);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
