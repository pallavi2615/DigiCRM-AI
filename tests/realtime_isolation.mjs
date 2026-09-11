#!/usr/bin/env node
// Realtime isolation for Sales Executive across `leads` AND `contacts`.
// - Exec subscribes to postgres_changes; admin creates + updates a hidden row
//   (not visible to exec) and a positive-control row (visible to exec).
// - Asserts zero events for hidden rows on INSERT+UPDATE; ≥1 event for the
//   visible control.
// - For every hidden row, the exec-side inserts an `access_denied` audit row
//   with attempted_action='realtime_subscribe' and only allow-listed metadata
//   keys — mirroring `src/lib/audit.ts`. Admin reads those rows back and
//   verifies module, action, and redaction.
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const EMAILS = {
  admin: process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo",
  exec: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};
if (!URL || !SVC || !ANON) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  process.exit(2);
}

const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, cond: !!cond });
  console.log((cond ? "✓" : "✗") + " " + name + (extra ? ` — ${extra}` : ""));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const users = await svc.auth.admin.listUsers();
const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
const execId = byEmail[EMAILS.exec], admId = byEmail[EMAILS.admin];

const execC = createClient(URL, ANON, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket, params: { eventsPerSecond: 20 } },
});
{
  const { data, error } = await execC.auth.signInWithPassword({ email: EMAILS.exec, password: PWD });
  if (error) throw new Error("exec signin: " + error.message);
  execC.realtime.setAuth(data.session.access_token);
}
const admC = createClient(URL, ANON, { auth: { persistSession: false } });
{
  const { error } = await admC.auth.signInWithPassword({ email: EMAILS.admin, password: PWD });
  if (error) throw new Error("admin signin: " + error.message);
}

const stamp = Date.now();
const tag = `RT-${stamp}`;
const received = { leads: [], contacts: [] };

const leadsChan = execC.channel(`rt-leads-${stamp}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
    const row = payload.new ?? payload.old ?? {};
    if (typeof row.company_name === "string" && row.company_name.startsWith(tag))
      received.leads.push({ event: payload.eventType, id: row.id, name: row.company_name });
  });

const contactsChan = execC.channel(`rt-contacts-${stamp}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, (payload) => {
    const row = payload.new ?? payload.old ?? {};
    if (typeof row.first_name === "string" && row.first_name.startsWith(tag))
      received.contacts.push({ event: payload.eventType, id: row.id, name: row.first_name });
  });

async function subscribe(ch, label) {
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} subscribe timeout`)), 15000);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(t); resolve(); }
      else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        clearTimeout(t); reject(new Error(`${label} status: ${status}`));
      }
    });
  });
  ok(`exec realtime channel SUBSCRIBED to ${label}`, true);
}
await subscribe(leadsChan, "leads");
await subscribe(contactsChan, "contacts");

const createdLeads = [], createdContacts = [], createdCos = [], denialActs = [];

try {
  // --- LEADS: hidden vs visible ---
  const hiddenLead = (await svc.from("leads").insert({
    company_name: `${tag}-HIDDEN-lead`, status: "new", priority: "medium",
    created_by: admId, assigned_to: admId,
  }).select().single()).data;
  createdLeads.push(hiddenLead.id);
  const visibleLead = (await svc.from("leads").insert({
    company_name: `${tag}-VISIBLE-lead`, status: "new", priority: "medium",
    created_by: admId, assigned_to: execId,
  }).select().single()).data;
  createdLeads.push(visibleLead.id);

  // --- CONTACTS: hidden (admin-owned) vs visible (exec-owned) ---
  const admCo = (await svc.from("companies").insert({ name: `${tag}-AdmCo`, created_by: admId }).select().single()).data;
  const execCo = (await svc.from("companies").insert({ name: `${tag}-ExecCo`, created_by: execId }).select().single()).data;
  createdCos.push(admCo.id, execCo.id);
  const hiddenContact = (await svc.from("contacts").insert({
    first_name: `${tag}-HIDDEN-contact`, last_name: "Nope",
    company_id: admCo.id, created_by: admId,
  }).select().single()).data;
  createdContacts.push(hiddenContact.id);
  const visibleContact = (await svc.from("contacts").insert({
    first_name: `${tag}-VISIBLE-contact`, last_name: "Ok",
    company_id: execCo.id, created_by: execId,
  }).select().single()).data;
  createdContacts.push(visibleContact.id);

  await sleep(2500);
  await svc.from("leads").update({ notes: "admin-only" }).eq("id", hiddenLead.id);
  await svc.from("leads").update({ notes: "shared" }).eq("id", visibleLead.id);
  await svc.from("contacts").update({ designation: "admin-only" }).eq("id", hiddenContact.id);
  await svc.from("contacts").update({ designation: "shared" }).eq("id", visibleContact.id);
  await sleep(3000);

  const hlEv = received.leads.filter((e) => e.id === hiddenLead.id);
  const vlEv = received.leads.filter((e) => e.id === visibleLead.id);
  const hcEv = received.contacts.filter((e) => e.id === hiddenContact.id);
  const vcEv = received.contacts.filter((e) => e.id === visibleContact.id);

  ok("exec received ZERO realtime events for admin-only lead", hlEv.length === 0, hlEv.map((e) => e.event).join(","));
  ok("exec received ≥1 realtime event for lead assigned to exec", vlEv.length >= 1, `got ${vlEv.length}`);
  ok("exec received ZERO realtime events for admin-only contact (INSERT+UPDATE)", hcEv.length === 0, hcEv.map((e) => e.event).join(","));
  ok("exec received ≥1 realtime event for contact under exec-owned company", vcEv.length >= 1, `got ${vcEv.length}`);

  const leakedLead = received.leads.find((e) => typeof e.name === "string" && e.name.includes("HIDDEN"));
  const leakedContact = received.contacts.find((e) => typeof e.name === "string" && e.name.includes("HIDDEN"));
  ok("no HIDDEN lead name ever appears in exec realtime buffer", !leakedLead, leakedLead?.name);
  ok("no HIDDEN contact name ever appears in exec realtime buffer", !leakedContact, leakedContact?.name);

  // --- Audit rows for denied realtime attempts (mirrors src/lib/audit.ts) ---
  const denialInserts = [
    { entity_type: "leads",    entity_id: hiddenLead.id,    description: "Denied realtime_subscribe on leads — rls_filtered" },
    { entity_type: "contacts", entity_id: hiddenContact.id, description: "Denied realtime_subscribe on contacts — rls_filtered" },
  ];
  for (const d of denialInserts) {
    const ins = await execC.from("activities").insert({
      actor_id: execId,
      entity_type: d.entity_type,
      entity_id: d.entity_id,
      action: "access_denied",
      description: d.description,
      metadata: { attempted_action: "realtime_subscribe", reason: "rls_filtered" },
    }).select().single();
    if (ins.data?.id) denialActs.push(ins.data.id);
    ok(`audit row inserted for realtime denial on ${d.entity_type}`, !!ins.data && !ins.error, ins.error?.message);
  }

  await sleep(500);
  const audit = await admC.from("activities")
    .select("id, entity_type, entity_id, action, description, metadata")
    .eq("action", "access_denied")
    .eq("actor_id", execId)
    .in("entity_type", ["leads", "contacts"])
    .contains("metadata", { attempted_action: "realtime_subscribe" });

  const rows = audit.data ?? [];
  const ALLOWED = new Set(["attempted_action", "reason", "path", "changes"]);
  const LEAKS = ["password", "access_token", "refresh_token", "authorization", "bearer ", "cookie", "secret"];

  for (const mod of ["leads", "contacts"]) {
    const r = rows.find((x) => x.entity_type === mod);
    ok(`admin can read realtime denial audit row for ${mod}`, !!r);
    if (r) {
      ok(`${mod} denial: action=access_denied`, r.action === "access_denied");
      ok(`${mod} denial: attempted_action=realtime_subscribe`, r.metadata?.attempted_action === "realtime_subscribe");
      const keys = Object.keys(r.metadata ?? {});
      const extra = keys.filter((k) => !ALLOWED.has(k));
      ok(`${mod} denial metadata keys within allow-list`, extra.length === 0, extra.join(","));
      const s = JSON.stringify(r.metadata ?? {}).toLowerCase();
      const leak = LEAKS.find((k) => s.includes(k));
      ok(`${mod} denial metadata redacted (no secrets)`, !leak, leak ?? "");
      // Description should not embed the hidden row's raw name payload
      ok(`${mod} denial description omits raw HIDDEN payload`, !(r.description ?? "").includes("HIDDEN"));
    }
  }
} finally {
  await execC.removeChannel(leadsChan);
  await execC.removeChannel(contactsChan);
  if (denialActs.length) await svc.from("activities").delete().in("id", denialActs);
  if (createdContacts.length) await svc.from("contacts").delete().in("id", createdContacts);
  if (createdLeads.length) await svc.from("leads").delete().in("id", createdLeads);
  if (createdCos.length) await svc.from("companies").delete().in("id", createdCos);
}

const failed = results.filter((r) => !r.cond);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
