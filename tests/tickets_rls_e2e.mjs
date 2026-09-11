#!/usr/bin/env node
// E2E: RLS + role-based access for support_tickets, ticket_replies,
// and contact_submissions across two isolated tenants and admin/non-admin roles.
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
const cleanup = { tenants: [], tickets: [], submissions: [] };

try {
  const admin = await signedIn(EMAILS.admin);
  const manager = await signedIn(EMAILS.manager);
  const exec = await signedIn(EMAILS.exec);

  // Two isolated tenants; manager → A, exec → B.
  const mk = async (tag) => {
    const { data, error } = await svc.from("tenants").insert({
      name: `Ticket ${tag} ${stamp}`, slug: `tickets-${tag}-${stamp}`,
      plan: "prime",
      owner_id: admin.userId, is_active: true,
    }).select("id").single();
    if (error) throw new Error(`tenant ${tag}: ${error.message}`);
    cleanup.tenants.push(data.id);
    return data.id;
  };
  const tA = await mk("A");
  const tB = await mk("B");
  await svc.from("tenant_members").upsert([
    { tenant_id: tA, user_id: manager.userId, role: "admin" },
    { tenant_id: tB, user_id: exec.userId, role: "member" },
  ], { onConflict: "tenant_id,user_id" });

  // Seed one ticket per tenant.
  const seed = async (tenant_id, subject) => {
    const { data, error } = await svc.from("support_tickets").insert({
      tenant_id, subject, description: "seed", status: "open",
      priority: "normal", urgency: "normal", channel: "portal",
      requester_email: `req-${stamp}@x.co`,
    }).select("id").single();
    if (error) throw new Error(`seed ticket: ${error.message}`);
    cleanup.tickets.push(data.id);
    return data.id;
  };
  const tkA = await seed(tA, `A ticket ${stamp}`);
  const tkB = await seed(tB, `B ticket ${stamp}`);

  // ---------- support_tickets ----------
  {
    const { data } = await manager.client.from("support_tickets")
      .select("id, tenant_id").in("id", [tkA, tkB]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("manager reads own tenant ticket", ids.has(tkA));
    check("manager cannot read foreign tenant ticket", !ids.has(tkB));
  }
  {
    const { data } = await exec.client.from("support_tickets")
      .select("id").in("id", [tkA, tkB]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("exec reads own tenant ticket", ids.has(tkB));
    check("exec cannot read foreign tenant ticket", !ids.has(tkA));
  }
  {
    const { data } = await admin.client.from("support_tickets")
      .select("id").in("id", [tkA, tkB]);
    const ids = new Set((data ?? []).map((r) => r.id));
    check("app admin reads tickets across tenants", ids.has(tkA) && ids.has(tkB));
  }
  {
    // Attempted tenant_id forgery: exec inserts ticket claiming Tenant A.
    const { data, error } = await exec.client.from("support_tickets").insert({
      tenant_id: tA, subject: "forgery", requester_email: `f-${stamp}@x.co`,
      priority: "normal", urgency: "normal", channel: "portal", status: "open",
    }).select("id");
    check("exec cannot insert ticket into foreign tenant (RLS)",
      !!error || !data || data.length === 0, error?.message);
  }
  {
    // NULL tenant_id bypass attempt from non-admin.
    const { data, error } = await exec.client.from("support_tickets").insert({
      tenant_id: null, subject: "null-bypass", requester_email: `n-${stamp}@x.co`,
      priority: "normal", urgency: "normal", channel: "portal", status: "open",
    }).select("id");
    check("non-admin cannot insert ticket with NULL tenant_id",
      !!error || !data || data.length === 0, error?.message);
  }
  {
    // Manager cannot update foreign ticket.
    const { data, error } = await exec.client.from("support_tickets")
      .update({ status: "closed" }).eq("id", tkA).select("id");
    check("exec cannot update foreign tenant ticket",
      !!error || !data || data.length === 0, error?.message);
  }
  {
    const { data } = await anon.from("support_tickets").select("id").in("id", [tkA, tkB]);
    check("anon cannot read support_tickets", !data || data.length === 0);
  }

  // ---------- ticket_replies ----------
  const seedReply = async (ticket_id, body, is_public = true) => {
    const { data, error } = await svc.from("ticket_replies").insert({
      ticket_id, body, is_public,
    }).select("id").single();
    if (error) throw new Error(`seed reply: ${error.message}`);
    return data.id;
  };
  await seedReply(tkA, "hello A");
  await seedReply(tkB, "hello B");

  {
    const { data } = await manager.client.from("ticket_replies")
      .select("id, ticket_id").in("ticket_id", [tkA, tkB]);
    const tickets = new Set((data ?? []).map((r) => r.ticket_id));
    check("manager reads replies of own tenant ticket", tickets.has(tkA));
    check("manager cannot read foreign ticket replies", !tickets.has(tkB));
  }
  {
    // Exec attempts to reply into foreign tenant's ticket.
    const { data, error } = await exec.client.from("ticket_replies").insert({
      ticket_id: tkA, body: "cross-tenant reply", is_public: true,
    }).select("id");
    check("exec cannot reply into foreign tenant ticket",
      !!error || !data || data.length === 0, error?.message);
  }
  {
    const { data } = await anon.from("ticket_replies").select("id");
    check("anon cannot read ticket_replies", !data || data.length === 0);
  }

  // ---------- contact_submissions ----------
  {
    // Anon can submit a valid contact form.
    const { data, error } = await anon.from("contact_submissions").insert({
      name: "Anon User", email: `anon-${stamp}@x.co`, message: "hello there",
    }).select("id");
    check("anon can submit valid contact form", !error && (data?.length ?? 0) === 1, error?.message);
    if (data?.[0]?.id) cleanup.submissions.push(data[0].id);
  }
  {
    // Anon cannot mark handled=true on insert.
    const { data, error } = await anon.from("contact_submissions").insert({
      name: "A", email: `bad-${stamp}@x.co`, message: "x", handled: true,
    }).select("id, handled");
    const rejected = !!error || !data || data.length === 0 || data[0].handled === false;
    check("anon cannot force handled=true on insert", rejected, error?.message);
    if (data?.[0]?.id) cleanup.submissions.push(data[0].id);
  }
  {
    // Anon cannot read submissions.
    const { data } = await anon.from("contact_submissions").select("id");
    check("anon cannot read contact_submissions", !data || data.length === 0);
  }
  {
    // Non-admin (exec) cannot read submissions.
    const { data } = await exec.client.from("contact_submissions").select("id");
    check("non-admin cannot read contact_submissions", !data || data.length === 0);
  }
  {
    // App admin can read.
    const { data, error } = await admin.client.from("contact_submissions").select("id").limit(1);
    check("app admin can read contact_submissions", !error, error?.message);
  }
} catch (err) {
  check("no exceptions", false, err.message);
} finally {
  if (cleanup.submissions.length)
    await svc.from("contact_submissions").delete().in("id", cleanup.submissions);
  if (cleanup.tickets.length) {
    await svc.from("ticket_replies").delete().in("ticket_id", cleanup.tickets);
    await svc.from("support_tickets").delete().in("id", cleanup.tickets);
  }
  if (cleanup.tenants.length) {
    await svc.from("tenant_members").delete().in("tenant_id", cleanup.tenants);
    await svc.from("tenants").delete().in("id", cleanup.tenants);
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
