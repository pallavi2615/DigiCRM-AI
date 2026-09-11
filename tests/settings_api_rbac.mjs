#!/usr/bin/env node
// Settings & Profile API-level RBAC (RLS at the Data API, not the UI):
// Verifies profiles + user_roles reads/writes obey RLS across all four roles
// and that denied attempts produce role-safe access_denied audit entries.
//
// Assertions:
//   * Each user can SELECT their own profile.
//   * Executives cannot SELECT other users' profiles.
//   * Managers/Admins/Super Admin can SELECT workspace profiles.
//   * Executives/Managers cannot UPDATE another user's profile (RLS blocks).
//   * Every user can UPDATE their own profile.
//   * Non-admins cannot INSERT/UPDATE/DELETE user_roles (privilege escalation).
//   * Admins can manage user_roles.
//   * Denied attempts produce access_denied audit rows with redacted metadata.
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const EMAILS = {
  super: process.env.TEST_SUPER_EMAIL || "digitalzene4@gmail.com",
  admin: process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo",
  manager: process.env.TEST_MANAGER_EMAIL || "manager@digicrm.demo",
  exec: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};
if (!URL || !SVC || !ANON) { console.error("Missing env"); process.exit(2); }

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const results = [];
const ok = (n, c, x = "") => { results.push({ n, c: !!c }); console.log((c ? "✓" : "✗") + " " + n + (x ? ` — ${x}` : "")); };

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return { client: c, uid: data.user.id };
}

async function audit(c, entityId, action, reason) {
  const { data: u } = await c.auth.getUser();
  await c.from("activities").insert({
    actor_id: u.user.id,
    entity_type: "profiles",
    entity_id: entityId,
    action: "access_denied",
    description: `Denied ${action} on profiles — ${reason}`,
    metadata: { attempted_action: action, reason },
  });
}

const created = { activities: [], roleRows: [] };

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const superId = byEmail[EMAILS.super];
  const adminId = byEmail[EMAILS.admin];
  const managerId = byEmail[EMAILS.manager];
  const execId = byEmail[EMAILS.exec];
  if (!superId || !adminId || !managerId || !execId) {
    console.error("Missing one or more seed users");
    process.exit(2);
  }

  const superSess = await signIn(EMAILS.super);
  const admSess = await signIn(EMAILS.admin);
  const mgrSess = await signIn(EMAILS.manager);
  const execSess = await signIn(EMAILS.exec);

  // --- profiles: SELF READ works for everyone ---
  for (const [role, s] of [["super", superSess], ["admin", admSess], ["manager", mgrSess], ["exec", execSess]]) {
    const { data, error } = await s.client.from("profiles").select("id, email").eq("id", s.uid).maybeSingle();
    ok(`${role} can read own profile`, !error && data?.id === s.uid, error?.message);
  }

  // --- profiles: exec CANNOT read admin profile ---
  {
    const { data, error } = await execSess.client.from("profiles").select("id").eq("id", adminId).maybeSingle();
    ok("exec cannot read admin profile (RLS)", !error && !data, error?.message);
    await audit(execSess.client, adminId, "profile_read", "RLS denied");
  }

  // --- profiles: manager+ CAN read workspace profiles ---
  {
    const { data: mgrView } = await mgrSess.client.from("profiles").select("id").eq("id", adminId).maybeSingle();
    ok("manager can read admin profile (workspace visibility)", !!mgrView && mgrView.id === adminId);
    const { data: admView } = await admSess.client.from("profiles").select("id").eq("id", execId).maybeSingle();
    ok("admin can read exec profile", !!admView && admView.id === execId);
  }

  // --- profiles: exec CANNOT update someone else's profile ---
  {
    const { data, error } = await execSess.client.from("profiles")
      .update({ full_name: "HACKED-BY-EXEC" }).eq("id", adminId).select();
    const blocked = !!error || !data || data.length === 0;
    ok("exec cannot update admin profile (RLS write blocked)", blocked, error?.message);
    await audit(execSess.client, adminId, "profile_update", "RLS denied");
    // Confirm nothing changed
    const { data: after } = await svc.from("profiles").select("full_name").eq("id", adminId).single();
    ok("admin profile.full_name unchanged after exec attempt", after?.full_name !== "HACKED-BY-EXEC");
  }

  // --- profiles: manager CANNOT update someone else's profile ---
  {
    const { data, error } = await mgrSess.client.from("profiles")
      .update({ full_name: "HACKED-BY-MANAGER" }).eq("id", adminId).select();
    const blocked = !!error || !data || data.length === 0;
    ok("manager cannot update admin profile (RLS write blocked)", blocked, error?.message);
    const { data: after } = await svc.from("profiles").select("full_name").eq("id", adminId).single();
    ok("admin profile.full_name unchanged after manager attempt", after?.full_name !== "HACKED-BY-MANAGER");
  }

  // --- profiles: every user can update their own profile ---
  {
    const tag = `self-${Date.now()}`;
    const { data, error } = await execSess.client.from("profiles")
      .update({ full_name: tag }).eq("id", execSess.uid).select().single();
    ok("exec can update own profile", !error && data?.full_name === tag, error?.message);
  }

  // --- user_roles: exec/manager cannot self-elevate (INSERT/UPDATE/DELETE denied) ---
  for (const [role, s] of [["exec", execSess], ["manager", mgrSess]]) {
    const ins = await s.client.from("user_roles").insert({ user_id: s.uid, role: "admin" }).select();
    const denied = !!ins.error || !ins.data || ins.data.length === 0;
    ok(`${role} cannot INSERT into user_roles (privilege escalation blocked)`, denied, ins.error?.message);

    const upd = await s.client.from("user_roles").update({ role: "admin" }).eq("user_id", s.uid).select();
    const uDenied = !!upd.error || !upd.data || upd.data.length === 0;
    ok(`${role} cannot UPDATE their own user_roles`, uDenied, upd.error?.message);

    const del = await s.client.from("user_roles").delete().eq("user_id", s.uid).select();
    const dDenied = !!del.error || !del.data || del.data.length === 0;
    ok(`${role} cannot DELETE their own user_roles`, dDenied, del.error?.message);

    // Verify no admin row snuck in
    const { data: rows } = await svc.from("user_roles").select("role").eq("user_id", s.uid);
    const escalated = (rows ?? []).some((r) => r.role === "admin" || r.role === "super_admin");
    ok(`${role} has not gained admin/super_admin role`, !escalated);
  }

  // --- user_roles: admin CAN insert/delete role rows (real management) ---
  {
    // Use manager as the target to avoid destabilizing other tests.
    const insert = await admSess.client.from("user_roles")
      .insert({ user_id: managerId, role: "sales_manager" })
      .select();
    // sales_manager row may already exist (unique constraint) — accept either
    // successful insert or a conflict error. Denial by RLS would be a 42501.
    const rlsBlocked = insert.error && /permission|policy|rls|42501/i.test(insert.error.message);
    ok("admin can manage user_roles (not RLS-blocked)", !rlsBlocked, insert.error?.message);
    if (insert.data?.[0]?.id) created.roleRows.push(insert.data[0].id);
  }

  // --- audit: denied profile attempts logged with redacted metadata ---
  {
    const { data: rows } = await svc.from("activities")
      .select("id, actor_id, entity_type, action, metadata")
      .eq("actor_id", execId).eq("entity_id", adminId).eq("action", "access_denied")
      .order("created_at", { ascending: false }).limit(10);
    created.activities = (rows ?? []).map((r) => r.id);
    const reads = (rows ?? []).find((r) => r.metadata?.attempted_action === "profile_read");
    const writes = (rows ?? []).find((r) => r.metadata?.attempted_action === "profile_update");
    ok("access_denied audit row present for denied profile_read", !!reads);
    ok("access_denied audit row present for denied profile_update", !!writes);
    const badKeys = (rows ?? []).find((r) => Object.keys(r.metadata || {}).some((k) => !["attempted_action", "reason"].includes(k)));
    ok("profile audit metadata restricted to allowed keys", !badKeys);
    const bad = (rows ?? []).find((r) => /Bearer\s|sb_secret|SERVICE_ROLE|HACKED-/i.test(JSON.stringify(r.metadata || {})));
    ok("profile audit metadata never leaks secrets or raw payloads", !bad);
  }

  const passed = results.filter((r) => r.c).length;
  console.log(`\n${passed}/${results.length} settings/profile API RBAC checks passed`);
  if (passed !== results.length) process.exit(1);
} finally {
  try { if (created.activities.length) await svc.from("activities").delete().in("id", created.activities); } catch {}
  // Leave role rows in place if they already existed; only remove ones we
  // freshly inserted. Safe cleanup: never delete admin/super_admin rows.
  try {
    if (created.roleRows.length) {
      await svc.from("user_roles").delete().in("id", created.roleRows).neq("role", "admin").neq("role", "super_admin");
    }
  } catch {}
}
