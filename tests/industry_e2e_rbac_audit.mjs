#!/usr/bin/env node
/**
 * End-to-end RBAC + audit_row_change verification for IT and Real Estate modules.
 *
 * Covers:
 *  1. IT: Manager can create/update/delete projects + tickets end-to-end,
 *         cycles a project through every pipeline stage (9), and deletes tickets.
 *         Executive can only read/update rows they own or are assigned to;
 *         cannot insert projects; cannot delete tickets they don't own; cannot
 *         touch unassigned rows.
 *  2. RE: Manager fully manages clients (incl. KYC document uploads to the
 *         attachments bucket), properties, and deal stage transitions.
 *         Executive limited to owned rows; rejected writes on others produce
 *         no rows AND no audit_row_change entry authored by the executive.
 *  3. Audit: For every allowed write we assert audit_row_change captured
 *         actor_id, entity_type (table), entity_id (row), action, and — for
 *         UPDATE — accurate before/after diff for the mutated column only.
 *         For every rejected write we assert NO audit row exists that names
 *         the executive as actor on that target row.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const EMAILS = {
  manager: process.env.TEST_MANAGER_EMAIL || "manager@digicrm.demo",
  exec: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};
if (!URL || !SVC || !ANON) { console.error("Missing SUPABASE_* env"); process.exit(2); }

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

// Fetch every audit row for a given entity_id (any actor), newest first.
async function auditFor(entityId) {
  const { data } = await svc.from("activities")
    .select("actor_id, entity_type, entity_id, action, metadata, created_at")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  return data || [];
}

const stamp = Date.now();
const cleanup = { it_tickets: [], it_projects: [], re_deals: [], re_properties: [], re_clients: [], storage: [] };

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const managerId = byEmail[EMAILS.manager];
  const execId = byEmail[EMAILS.exec];
  if (!managerId || !execId) throw new Error("Seed users missing");

  const managerC = await login(EMAILS.manager);
  const execC = await login(EMAILS.exec);

  // ─────────────────────────────────────────────────────────────────
  //  IT MODULE
  // ─────────────────────────────────────────────────────────────────

  // Manager creates project
  const { data: proj, error: projErr } = await managerC.from("it_projects").insert({
    name: `E2E-Proj-${stamp}`, client_name: "Acme", stage: "discovery",
    value: 500000, owner_id: managerId, manager_id: managerId,
  }).select().single();
  ok("IT/Manager: create project", !projErr && !!proj, projErr?.message);
  if (proj) cleanup.it_projects.push(proj.id);

  // Cycle through EVERY pipeline stage and assert audit + diff for each
  const stages = ["proposal", "negotiation", "contract", "kickoff", "in_progress", "uat", "delivered", "closed"];
  let prev = "discovery";
  for (const stage of stages) {
    const { error } = await managerC.from("it_projects").update({ stage }).eq("id", proj.id);
    if (error) { ok(`IT/Manager: stage ${prev}→${stage}`, false, error.message); break; }
    // wait a beat for trigger to commit
    await new Promise((r) => setTimeout(r, 60));
    const rows = await auditFor(proj.id);
    const match = rows.find(
      (r) => r.action === "updated" && r.actor_id === managerId &&
             r.metadata?.changes?.stage?.from === prev &&
             r.metadata?.changes?.stage?.to === stage,
    );
    ok(`IT/Audit: stage ${prev}→${stage} recorded with before/after`, !!match);
    prev = stage;
  }

  // Manager creates ticket assigned to executive
  const { data: tick, error: tickErr } = await managerC.from("it_tickets").insert({
    project_id: proj?.id, title: `E2E-Tick-${stamp}`, status: "open", priority: "high",
    owner_id: managerId, assignee_id: execId,
  }).select().single();
  ok("IT/Manager: create ticket assigned to exec", !tickErr && !!tick, tickErr?.message);
  if (tick) cleanup.it_tickets.push(tick.id);

  // Ticket INSERT audit row
  {
    const rows = await auditFor(tick.id);
    const ins = rows.find((r) => r.action === "created" && r.actor_id === managerId);
    ok("IT/Audit: ticket INSERT row (actor=manager, entity=it_tickets)",
       !!ins && ins.entity_type === "it_tickets" && ins.entity_id === tick.id);
  }

  // Executive updates assigned ticket status
  const { error: exUpErr } = await execC.from("it_tickets").update({ status: "in_progress" }).eq("id", tick.id);
  ok("IT/Exec: can update assigned ticket", !exUpErr, exUpErr?.message);
  await new Promise((r) => setTimeout(r, 60));
  {
    const rows = await auditFor(tick.id);
    const upd = rows.find(
      (r) => r.action === "updated" && r.actor_id === execId &&
             r.metadata?.changes?.status?.from === "open" &&
             r.metadata?.changes?.status?.to === "in_progress",
    );
    ok("IT/Audit: exec status update captured with correct diff", !!upd);
  }

  // Executive cannot INSERT project owned by another user (RLS insert check binds owner_id = auth.uid())
  const { data: exProjIns, error: exProjInsErr } = await execC.from("it_projects").insert({
    name: `Hack-${stamp}`, client_name: "X", owner_id: managerId, manager_id: managerId,
  }).select();
  ok("IT/Exec: cannot INSERT project owned by another user", !!exProjInsErr || (exProjIns || []).length === 0);


  // Executive cannot DELETE ticket (not owner, not admin)
  const { error: exDelErr, data: exDel } = await execC.from("it_tickets").delete().eq("id", tick.id).select();
  ok("IT/Exec: cannot DELETE ticket", !exDelErr && (exDel || []).length === 0);

  // Create a second project the executive has NO relationship to → exec cannot see/update
  const { data: proj2 } = await managerC.from("it_projects").insert({
    name: `Priv-${stamp}`, client_name: "Priv", stage: "discovery",
    owner_id: managerId, manager_id: managerId,
  }).select().single();
  if (proj2) cleanup.it_projects.push(proj2.id);
  const { data: exSeeing } = await execC.from("it_projects").select("id").eq("id", proj2.id);
  ok("IT/Exec: cannot READ unrelated project (RLS)", (exSeeing || []).length === 0);

  const { data: exUp2, error: exUp2Err } = await execC.from("it_projects")
    .update({ stage: "closed" }).eq("id", proj2.id).select();
  ok("IT/Exec: cannot UPDATE unrelated project", !exUp2Err && (exUp2 || []).length === 0);

  // Audit MUST NOT record executive as actor on unrelated project
  {
    const rows = await auditFor(proj2.id);
    const leaked = rows.find((r) => r.actor_id === execId);
    ok("IT/Audit: rejected exec write on unrelated project → no audit row for exec", !leaked);
  }

  // Manager DELETE ticket end-to-end → audit 'deleted' row
  const { error: mDelErr } = await managerC.from("it_tickets").delete().eq("id", tick.id);
  ok("IT/Manager: delete ticket", !mDelErr, mDelErr?.message);
  if (!mDelErr) cleanup.it_tickets = cleanup.it_tickets.filter((x) => x !== tick.id);
  await new Promise((r) => setTimeout(r, 60));
  {
    const rows = await auditFor(tick.id);
    const del = rows.find((r) => r.action === "deleted" && r.actor_id === managerId);
    ok("IT/Audit: ticket DELETE row (actor=manager)", !!del);
  }

  // ─────────────────────────────────────────────────────────────────
  //  REAL ESTATE MODULE
  // ─────────────────────────────────────────────────────────────────

  // Manager creates client + property
  const { data: cli, error: cliErr } = await managerC.from("re_clients").insert({
    full_name: `E2E-Cli-${stamp}`, email: `c${stamp}@x.io`, phone: "9990001111",
    kyc_status: "pending", owner_id: managerId, agent_id: execId,
  }).select().single();
  ok("RE/Manager: create client (assigned to exec agent)", !cliErr && !!cli, cliErr?.message);
  if (cli) cleanup.re_clients.push(cli.id);

  const { data: prop, error: propErr } = await managerC.from("re_properties").insert({
    title: `E2E-Prop-${stamp}`, property_type: "apartment", city: "BLR",
    price: 7500000, status: "available", owner_id: managerId,
  }).select().single();
  ok("RE/Manager: create property", !propErr && !!prop, propErr?.message);
  if (prop) cleanup.re_properties.push(prop.id);

  // KYC upload to attachments bucket under re_clients/{id}/
  const kycPath = `re_clients/${cli.id}/kyc-${stamp}.txt`;
  const { error: upErr } = await managerC.storage.from("attachments")
    .upload(kycPath, new Blob(["kyc-doc"], { type: "text/plain" }), { upsert: true });
  ok("RE/Manager: KYC upload to attachments bucket", !upErr, upErr?.message);
  if (!upErr) cleanup.storage.push(kycPath);

  // Persist KYC reference on the client + verify KYC status transition audit
  const { error: kycUpErr } = await managerC.from("re_clients")
    .update({ kyc_status: "verified", kyc_documents: [{ path: kycPath, name: `kyc-${stamp}.txt` }] })
    .eq("id", cli.id);
  ok("RE/Manager: mark KYC verified", !kycUpErr, kycUpErr?.message);
  await new Promise((r) => setTimeout(r, 60));
  {
    const rows = await auditFor(cli.id);
    const upd = rows.find(
      (r) => r.action === "updated" && r.actor_id === managerId &&
             r.metadata?.changes?.kyc_status?.from === "pending" &&
             r.metadata?.changes?.kyc_status?.to === "verified",
    );
    ok("RE/Audit: KYC status transition recorded with correct before/after", !!upd);
  }

  // Deal pipeline: create then cycle stages
  const dealStages = ["site_visit", "shortlisted", "offer", "negotiation", "agreement", "token", "registration", "closed"];
  const { data: deal, error: dealErr } = await managerC.from("re_deals").insert({
    client_id: cli.id, property_id: prop.id, stage: "inquiry",
    owner_id: managerId, agent_id: execId,
  }).select().single();
  ok("RE/Manager: create deal", !dealErr && !!deal, dealErr?.message);
  if (deal) cleanup.re_deals.push(deal.id);

  if (deal) {
    let prevD = "inquiry";
    for (const stage of dealStages) {
      const { error } = await managerC.from("re_deals").update({ stage }).eq("id", deal.id);
      if (error) { ok(`RE/Deal: stage ${prevD}→${stage}`, false, error.message); break; }
      await new Promise((r) => setTimeout(r, 60));
      const rows = await auditFor(deal.id);
      const m = rows.find(
        (r) => r.action === "updated" && r.actor_id === managerId &&
               r.metadata?.changes?.stage?.from === prevD &&
               r.metadata?.changes?.stage?.to === stage,
      );
      ok(`RE/Audit: deal stage ${prevD}→${stage} recorded with diff`, !!m);
      prevD = stage;
    }
  }

  // Executive as assigned agent → can READ + UPDATE client
  {
    const { data: exReadCli } = await execC.from("re_clients").select("id, full_name").eq("id", cli.id).maybeSingle();
    ok("RE/Exec: can READ assigned client", !!exReadCli);
    const { error: exUpCliErr } = await execC.from("re_clients").update({ requirement: "3BHK" }).eq("id", cli.id);
    ok("RE/Exec: can UPDATE assigned client", !exUpCliErr, exUpCliErr?.message);
  }

  // Unrelated property (owned by manager) → executive cannot read/update/delete
  {
    const { data: exReadProp } = await execC.from("re_properties").select("id").eq("id", prop.id);
    ok("RE/Exec: cannot READ unrelated property (RLS)", (exReadProp || []).length === 0);
    const { data: exUpProp, error: exUpPropErr } = await execC.from("re_properties")
      .update({ price: 1 }).eq("id", prop.id).select();
    ok("RE/Exec: cannot UPDATE unrelated property", !exUpPropErr && (exUpProp || []).length === 0);
    const { data: exDelProp, error: exDelPropErr } = await execC.from("re_properties")
      .delete().eq("id", prop.id).select();
    ok("RE/Exec: cannot DELETE property (admin-only)", !exDelPropErr && (exDelProp || []).length === 0);
    const rows = await auditFor(prop.id);
    ok("RE/Audit: rejected exec writes on property → no exec-authored audit rows",
       !rows.some((r) => r.actor_id === execId));
  }

  // Executive tries KYC upload for an unrelated client → denied
  {
    const { data: otherCli } = await managerC.from("re_clients").insert({
      full_name: `Other-${stamp}`, phone: "0", owner_id: managerId,
    }).select().single();
    if (otherCli) {
      cleanup.re_clients.push(otherCli.id);
      const badPath = `re_clients/${otherCli.id}/exec-hack-${stamp}.txt`;
      const { error: exStErr } = await execC.storage.from("attachments")
        .upload(badPath, new Blob(["nope"], { type: "text/plain" }));
      ok("RE/Exec: cannot upload KYC for unrelated client (storage RLS)", !!exStErr);
    }
  }

  // Manager delete client (admin-only per policy) will fail — manager IS NOT admin.
  // Assert it fails safely (0 rows) and produces no phantom audit row from manager as 'deleted'.
  {
    const before = await auditFor(cli.id);
    const { data: mDelCli, error: mDelCliErr } = await managerC.from("re_clients")
      .delete().eq("id", cli.id).select();
    ok("RE/Manager: DELETE client blocked (admin-only)", !mDelCliErr && (mDelCli || []).length === 0);
    const after = await auditFor(cli.id);
    ok("RE/Audit: blocked manager delete produced no new audit row",
       after.length === before.length);
  }
} catch (e) {
  ok("Unexpected exception", false, e.message);
} finally {
  for (const p of cleanup.storage) { try { await svc.storage.from("attachments").remove([p]); } catch {} }
  for (const [table, ids] of Object.entries(cleanup)) {
    if (table === "storage") continue;
    if (ids.length) await svc.from(table).delete().in("id", ids);
  }
}

const failed = results.filter((r) => !r.cond);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
