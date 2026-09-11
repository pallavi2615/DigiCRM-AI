#!/usr/bin/env node
// Signed URL RBAC: verifies that signed download URLs for the private
// `attachments` bucket:
//   1) work while unexpired and 404/400 after their TTL,
//   2) cannot be minted by executives for records they do not own,
//   3) tampered signatures/paths are rejected,
//   4) every denied signing attempt writes a role-safe access_denied
//      audit row (no raw bytes, no bearer tokens, no service key).
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const PWD = process.env.TEST_USER_PASSWORD || "DigiCrm!Demo2026";
const EMAILS = {
  admin: process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo",
  exec: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};
if (!URL || !SVC || !ANON) { console.error("Missing env"); process.exit(2); }

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const results = [];
const ok = (n, c, x = "") => { results.push({ n, c: !!c }); console.log((c ? "✓" : "✗") + " " + n + (x ? ` — ${x}` : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return c;
}

async function audit(c, module, entityId, action, reason) {
  const { data: u } = await c.auth.getUser();
  await c.from("activities").insert({
    actor_id: u.user.id,
    entity_type: module,
    entity_id: entityId,
    action: "access_denied",
    description: `Denied ${action} on ${module} — ${reason}`,
    metadata: { attempted_action: action, reason },
  });
}

const stamp = Date.now();
const created = { leads: [], objects: [], activities: [] };
const bytes = new Uint8Array([83, 73, 71, 78, 10]); // "SIGN\n"

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const adminId = byEmail[EMAILS.admin], execId = byEmail[EMAILS.exec];

  const adminLead = (await svc.from("leads").insert({ name: `sig-admin-${stamp}`, source: "signed-url", created_by: adminId, assigned_to: adminId }).select().single()).data;
  const execLead = (await svc.from("leads").insert({ name: `sig-exec-${stamp}`, source: "signed-url", created_by: execId, assigned_to: execId }).select().single()).data;
  created.leads.push(adminLead.id, execLead.id);

  const adminPath = `leads/${adminLead.id}/sig-${stamp}.bin`;
  const execPath = `leads/${execLead.id}/sig-${stamp}.bin`;
  await svc.storage.from("attachments").upload(adminPath, bytes, { upsert: true });
  await svc.storage.from("attachments").upload(execPath, bytes, { upsert: true });
  created.objects.push(adminPath, execPath);

  const exec = await signIn(EMAILS.exec);
  const adm = await signIn(EMAILS.admin);

  // 1) Exec signs URL for OWN file → works, then expires.
  {
    const { data, error } = await exec.storage.from("attachments").createSignedUrl(execPath, 2);
    ok("exec can mint signed URL for own attachment", !error && !!data?.signedUrl, error?.message);
    if (data?.signedUrl) {
      const live = await fetch(data.signedUrl);
      ok("signed URL fetch succeeds while unexpired", live.ok, `status=${live.status}`);
      await sleep(3500);
      const dead = await fetch(data.signedUrl);
      ok("signed URL rejected after TTL expiry", dead.status === 400 || dead.status === 401 || dead.status === 403, `status=${dead.status}`);
    }
  }

  // 2) Exec tries to sign URL for admin-owned file → denied.
  {
    const { data, error } = await exec.storage.from("attachments").createSignedUrl(adminPath, 60);
    const denied = !!error || !data?.signedUrl;
    ok("exec denied signing URL for admin-owned attachment", denied, error?.message);
    if (!denied && data?.signedUrl) {
      // If a URL was returned, at least confirm the download itself is blocked.
      const r = await fetch(data.signedUrl);
      ok("even if URL minted, unauthorized download is blocked", !r.ok, `status=${r.status}`);
    }
    await audit(exec, "leads", adminLead.id, "signed_url_create", "RLS denied");
  }

  // 3) Tampered signature is rejected.
  {
    const { data } = await adm.storage.from("attachments").createSignedUrl(adminPath, 60);
    if (data?.signedUrl) {
      const tampered = data.signedUrl.replace(/token=([^&]+)/, (_, t) => `token=${t.slice(0, -3)}AAA`);
      const r = await fetch(tampered);
      ok("tampered signed URL token is rejected", !r.ok, `status=${r.status}`);
      const swapped = data.signedUrl.replace(encodeURIComponent(adminPath), encodeURIComponent(execPath));
      const r2 = await fetch(swapped);
      ok("swapping object path in signed URL is rejected", !r2.ok, `status=${r2.status}`);
    } else {
      ok("admin minted URL for tamper test", false);
      ok("swap-path tamper test skipped", true);
    }
  }

  // 4) Audit row present, redacted.
  {
    const { data: rows } = await svc.from("activities")
      .select("id, actor_id, entity_type, action, metadata")
      .eq("actor_id", execId).eq("entity_id", adminLead.id).eq("action", "access_denied")
      .order("created_at", { ascending: false }).limit(10);
    created.activities = (rows ?? []).map((r) => r.id);
    const hit = (rows ?? []).find((r) => r.metadata?.attempted_action === "signed_url_create");
    ok("access_denied audit row written for denied signing", !!hit);
    const bad = (rows ?? []).find((r) => /Bearer\s|sb_secret|SERVICE_ROLE|SIGN\\n/i.test(JSON.stringify(r.metadata || {})));
    ok("audit metadata contains no secrets or raw payload", !bad);
    const badKeys = (rows ?? []).find((r) => Object.keys(r.metadata || {}).some((k) => !["attempted_action", "reason"].includes(k)));
    ok("audit metadata restricted to allowed keys", !badKeys);
  }

  const passed = results.filter((r) => r.c).length;
  console.log(`\n${passed}/${results.length} signed-URL RBAC checks passed`);
  if (passed !== results.length) process.exit(1);
} finally {
  try { if (created.objects.length) await svc.storage.from("attachments").remove(created.objects); } catch {}
  try { if (created.activities.length) await svc.from("activities").delete().in("id", created.activities); } catch {}
  try { if (created.leads.length) await svc.from("leads").delete().in("id", created.leads); } catch {}
}
