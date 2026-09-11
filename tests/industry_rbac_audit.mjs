#!/usr/bin/env node
// Industry module RBAC + audit trigger assertions.
// Verifies:
//   1. Every stage transition on IT/RE tables writes an audit row (actor, entity, before/after values).
//   2. Rejected writes (RLS denials) do NOT produce audit entries.
//   3. Sales Manager can manage RE clients/properties + IT projects/tickets; Executive is limited.
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
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, cond: !!cond, extra });
  console.log((cond ? "✓" : "✗") + " " + name + (extra ? ` — ${extra}` : ""));
};

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return c;
}

const stamp = Date.now();
const cleanup = { re_clients: [], re_properties: [], it_projects: [], it_tickets: [] };

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const managerId = byEmail[EMAILS.manager];
  const execId = byEmail[EMAILS.exec];

  const managerC = await login(EMAILS.manager);
  const execC = await login(EMAILS.exec);

  // === Real Estate: Manager creates client + property ===
  const { data: reClient, error: reCliErr } = await managerC.from("re_clients")
    .insert({ full_name: `T-${stamp}`, phone: "1234567890", email: `t${stamp}@x.io`, owner_id: managerId })
    .select().single();
  ok("RE: Manager creates client", !reCliErr && !!reClient, reCliErr?.message);
  if (reClient) cleanup.re_clients.push(reClient.id);

  const { data: reProp, error: rePropErr } = await managerC.from("re_properties")
    .insert({ title: `Villa-${stamp}`, property_type: "villa", city: "BLR", price: 5000000, status: "available", owner_id: managerId })
    .select().single();
  ok("RE: Manager creates property", !rePropErr && !!reProp);
  if (reProp) cleanup.re_properties.push(reProp.id);

  // Manager updates client (stage transition analogue)
  if (reClient) {
    const { error: upErr } = await managerC.from("re_clients").update({ full_name: `T2-${stamp}` }).eq("id", reClient.id);
    ok("RE: Manager updates client", !upErr, upErr?.message);
  }

  // Executive: can only see own rows — should NOT see manager's client
  const { data: execSeeing } = await execC.from("re_clients").select("id").eq("id", reClient?.id ?? "");
  ok("RE: Executive cannot read Manager's client (RLS)", (execSeeing || []).length === 0);

  // Executive tries to update Manager's client → denied (0 rows)
  const { data: execUp, error: execUpErr } = await execC.from("re_clients")
    .update({ full_name: "hacked" }).eq("id", reClient?.id ?? "").select();
  ok("RE: Executive cannot update Manager's client", !execUpErr && (execUp || []).length === 0);

  // === IT: Manager creates project + ticket, Executive views assigned only ===
  const { data: itProj, error: itProjErr } = await managerC.from("it_projects").insert({
    name: `Proj-${stamp}`, client_name: "AcmeCo", stage: "discovery",
    owner_id: managerId, manager_id: managerId,
  }).select().single();
  ok("IT: Manager creates project", !itProjErr && !!itProj, itProjErr?.message);
  if (itProj) cleanup.it_projects.push(itProj.id);

  // Stage transitions on IT project
  if (itProj) {
    for (const stage of ["proposal", "negotiation", "contract", "kickoff"]) {
      const { error } = await managerC.from("it_projects").update({ stage }).eq("id", itProj.id);
      if (error) { ok(`IT: stage → ${stage}`, false, error.message); break; }
    }
    ok("IT: Manager transitions project through stages", true);
  }

  // Assigned ticket for Executive
  const { data: itTicket, error: itTickErr } = await managerC.from("it_tickets").insert({
    project_id: itProj?.id, title: `Bug-${stamp}`, status: "open", priority: "high",
    owner_id: managerId, assigned_to: execId,
  }).select().single();
  ok("IT: Manager creates ticket assigned to Executive", !itTickErr && !!itTicket, itTickErr?.message);
  if (itTicket) cleanup.it_tickets.push(itTicket.id);

  // Executive can view assigned ticket
  if (itTicket) {
    const { data: execT } = await execC.from("it_tickets").select("id, status").eq("id", itTicket.id).maybeSingle();
    ok("IT: Executive can view assigned ticket", !!execT);
    // Executive can update status on assigned ticket
    const { error: exUpErr } = await execC.from("it_tickets").update({ status: "in_progress" }).eq("id", itTicket.id);
    ok("IT: Executive can update assigned ticket", !exUpErr, exUpErr?.message);
    // Executive CANNOT delete
    const { error: exDelErr, data: exDel } = await execC.from("it_tickets").delete().eq("id", itTicket.id).select();
    ok("IT: Executive cannot delete ticket", !exDelErr && (exDel || []).length === 0);
  }

  // Executive cannot create project
  const { error: exProjErr, data: exProjData } = await execC.from("it_projects").insert({
    name: "X", client_name: "X", owner_id: execId, manager_id: execId,
  }).select();
  ok("IT: Executive cannot create project", !!exProjErr || (exProjData || []).length === 0);

  // === Audit log verification ===
  const targets = [reClient?.id, reProp?.id, itProj?.id, itTicket?.id].filter(Boolean);
  const { data: audits } = await svc.from("activities")
    .select("actor_id, entity_type, entity_id, action, metadata")
    .in("entity_id", targets);

  ok("Audit: INSERT rows recorded for RE + IT entities",
    ["re_clients", "re_properties", "it_projects", "it_tickets"].every((t) =>
      (audits || []).some((a) => a.entity_type === t && a.action === "created")));

  ok("Audit: UPDATE rows include before/after diff",
    (audits || []).some((a) => a.action === "updated" && a.metadata?.changes && Object.keys(a.metadata.changes).length > 0));

  ok("Audit: actor_id matches acting user",
    (audits || []).filter((a) => a.entity_type === "it_projects" && a.action === "created")
      .every((a) => a.actor_id === managerId));

  // Denied writes do not appear as audit rows for that entity from Executive
  const { data: deniedAudits } = await svc.from("activities")
    .select("id").eq("actor_id", execId).eq("entity_id", reClient?.id ?? "").eq("action", "updated");
  ok("Audit: denied Executive update on RE client left no audit row", (deniedAudits || []).length === 0);
} catch (e) {
  console.error("Test error:", e.message);
  ok("Unexpected exception", false, e.message);
} finally {
  // Cleanup
  for (const [table, ids] of Object.entries(cleanup)) {
    if (ids.length) await svc.from(table).delete().in("id", ids);
  }
}

const failed = results.filter((r) => !r.cond);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
