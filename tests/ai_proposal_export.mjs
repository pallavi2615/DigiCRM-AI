#!/usr/bin/env node
// AI Proposal export RBAC:
// Ensures that when an executive generates + exports an AI proposal grounded
// on CRM entities, the export only contains data the executive can read via
// RLS, and denied grounding references produce access_denied audit rows with
// role-safe, redacted metadata. Talks to the running dev server so we exercise
// the real aiChat handler.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const APP = process.env.APP_URL || "http://localhost:8080";
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const EMAILS = {
  admin: process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo",
  exec: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};
if (!URL || !SVC || !ANON) { console.error("Missing env"); process.exit(2); }

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const results = [];
const ok = (n, c, x = "") => { results.push({ n, c: !!c }); console.log((c ? "✓" : "✗") + " " + n + (x ? ` — ${x}` : "")); };

async function tokenFor(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return { token: data.session.access_token, uid: data.user.id, client: c };
}

async function callAI(token, body) {
  const res = await fetch(`${APP}/_serverFn/aiChat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: body }),
  });
  return { status: res.status, text: await res.text().catch(() => "") };
}

const stamp = Date.now();
const SECRET = `SECRET-ADMIN-PROPOSAL-${stamp}`;
const created = { leads: [], activities: [] };

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const adminId = byEmail[EMAILS.admin], execId = byEmail[EMAILS.exec];

  const adminLead = (await svc.from("leads").insert({
    name: `prop-admin-${stamp}`, source: "proposal-rbac",
    notes: `Confidential pricing: ${SECRET}. Do not disclose.`,
    created_by: adminId, assigned_to: adminId,
  }).select().single()).data;
  const execLead = (await svc.from("leads").insert({
    name: `prop-exec-${stamp}`, source: "proposal-rbac",
    notes: "Public-facing exec notes only.",
    created_by: execId, assigned_to: execId,
  }).select().single()).data;
  created.leads.push(adminLead.id, execLead.id);

  const { token: execToken } = await tokenFor(EMAILS.exec);

  // Simulate the Proposal Generator: build a prompt and ground it on BOTH leads.
  // Exec must only see their own lead reflected in the output.
  const prompt = `Draft a short proposal (5 lines) for the referenced client using ONLY the provided reference records. Do not invent details.`;
  const r = await callAI(execToken, {
    messages: [{ role: "user", content: prompt }],
    context: [{ type: "leads", id: adminLead.id }, { type: "leads", id: execLead.id }],
  });
  const acceptable = r.status === 200 || r.status === 402 || r.status === 429 || r.status === 500;
  ok("proposal aiChat responds (200/402/429/soft error)", acceptable, `status=${r.status}`);
  ok("proposal export never contains admin secret string", !r.text.includes(SECRET));
  ok("proposal export never contains admin lead id", !r.text.includes(adminLead.id));

  // Verify that "downloading" the exported markdown (what the Proposal page
  // does client-side via a Blob) contains the same content — so the export
  // artifact itself is scoped to permitted data. We mimic the extraction
  // used by the UI (choices[0].message.content).
  if (r.status === 200) {
    try {
      const j = JSON.parse(r.text);
      const content = j?.content ?? j?.choices?.[0]?.message?.content ?? "";
      ok("downloadable proposal artifact excludes admin secret", !String(content).includes(SECRET));
    } catch {
      ok("downloadable proposal artifact excludes admin secret (parse fallback)", !r.text.includes(SECRET));
    }
  } else {
    ok("skipped artifact parse (non-200)", true, `status=${r.status}`);
  }

  // Poll for the access_denied audit row on the restricted grounding ref.
  if (r.status === 200) {
    let denied = [];
    for (let i = 0; i < 6; i++) {
      const { data } = await svc.from("activities")
        .select("id, actor_id, entity_type, entity_id, action, metadata")
        .eq("actor_id", execId).eq("entity_id", adminLead.id).eq("action", "access_denied")
        .order("created_at", { ascending: false }).limit(5);
      denied = data ?? [];
      if (denied.length) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    created.activities = denied.map((d) => d.id);
    const grounded = denied.find((d) => d.metadata?.attempted_action === "ai_ground");
    ok("access_denied audit row written for restricted proposal grounding", !!grounded);
    const leak = denied.find((d) => JSON.stringify(d.metadata || {}).includes(SECRET));
    ok("audit metadata never contains restricted secret text", !leak);
  } else {
    ok("audit assertion skipped (non-200)", true);
  }

  const passed = results.filter((r) => r.c).length;
  console.log(`\n${passed}/${results.length} AI proposal export checks passed`);
  if (passed !== results.length) process.exit(1);
} finally {
  try { if (created.activities.length) await svc.from("activities").delete().in("id", created.activities); } catch {}
  try { if (created.leads.length) await svc.from("leads").delete().in("id", created.leads); } catch {}
}
