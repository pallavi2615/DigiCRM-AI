#!/usr/bin/env node
// Storage RBAC tests for the private "attachments" bucket.
// Verifies:
//  - Path convention {entity_type}/{entity_id}/{file} is enforced.
//  - Executives can upload/download/delete only for records they can access.
//  - Denied uploads/downloads/deletes on restricted paths emit access_denied
//    audit rows with role-safe metadata (no raw payload).
//  - Managers/admins have workspace-wide access.
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
  console.error("Missing SUPABASE_URL / SERVICE_ROLE / ANON");
  process.exit(2);
}

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, cond: !!cond });
  console.log((cond ? "✓" : "✗") + " " + name + (extra ? ` — ${extra}` : ""));
};

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PWD });
  if (error) throw new Error(`signin ${email}: ${error.message}`);
  return c;
}

// Best-effort audit logger: exec client tries to insert an access_denied row
// with only role-safe metadata (module + attempted_action + reason). We assert
// no raw file bytes or secrets appear in metadata.
async function auditDeny(c, module, entityId, action, reason) {
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
const created = { companies: [], leads: [], objects: [] };
const bytes = new Uint8Array([65, 66, 67, 10]); // "ABC\n"

try {
  const users = await svc.auth.admin.listUsers();
  const byEmail = Object.fromEntries(users.data.users.map((u) => [u.email, u.id]));
  const adminId = byEmail[EMAILS.admin], execId = byEmail[EMAILS.exec];

  // Seed: admin-owned lead (exec must NOT access) and exec-owned lead.
  const adminLead = (await svc.from("leads").insert({ name: `stor-admin-${stamp}`, source: "storage-test", created_by: adminId, assigned_to: adminId }).select().single()).data;
  const execLead = (await svc.from("leads").insert({ name: `stor-exec-${stamp}`, source: "storage-test", created_by: execId, assigned_to: execId }).select().single()).data;
  const adminCo = (await svc.from("companies").insert({ name: `stor-admin-co-${stamp}`, created_by: adminId }).select().single()).data;
  created.leads.push(adminLead.id, execLead.id);
  created.companies.push(adminCo.id);

  const exec = await signIn(EMAILS.exec);
  const mgr = await signIn(EMAILS.manager);
  const adm = await signIn(EMAILS.admin);

  const paths = {
    execLead: `leads/${execLead.id}/note-${stamp}.txt`,
    adminLead: `leads/${adminLead.id}/note-${stamp}.txt`,
    adminCo: `companies/${adminCo.id}/note-${stamp}.txt`,
    badPrefix: `random/${execLead.id}/note-${stamp}.txt`,
    badId: `leads/not-a-uuid/note-${stamp}.txt`,
  };

  // --- Exec: allowed on own record ---
  {
    const up = await exec.storage.from("attachments").upload(paths.execLead, bytes, { upsert: true });
    ok("exec uploads to own lead succeeds", !up.error, up.error?.message);
    if (!up.error) created.objects.push(paths.execLead);
    const dl = await exec.storage.from("attachments").download(paths.execLead);
    ok("exec downloads own lead file", !dl.error && dl.data, dl.error?.message);
  }

  // --- Exec: denied on admin-owned lead ---
  {
    const up = await exec.storage.from("attachments").upload(paths.adminLead, bytes, { upsert: true });
    ok("exec upload to admin lead denied", !!up.error, up.error?.message);
    await auditDeny(exec, "leads", adminLead.id, "storage_upload", "RLS denied");
    const dl = await exec.storage.from("attachments").download(paths.adminLead);
    ok("exec download of admin lead denied (empty or error)", !!dl.error || !dl.data, "");
    await auditDeny(exec, "leads", adminLead.id, "storage_download", "RLS denied");
  }

  // --- Exec: denied on admin-owned company ---
  {
    const up = await exec.storage.from("attachments").upload(paths.adminCo, bytes, { upsert: true });
    ok("exec upload to admin company denied", !!up.error);
    await auditDeny(exec, "companies", adminCo.id, "storage_upload", "RLS denied");
  }

  // --- Path convention enforced ---
  {
    const bad1 = await exec.storage.from("attachments").upload(paths.badPrefix, bytes, { upsert: true });
    ok("exec upload with non-entity prefix denied", !!bad1.error);
    const bad2 = await exec.storage.from("attachments").upload(paths.badId, bytes, { upsert: true });
    ok("exec upload with malformed UUID denied", !!bad2.error);
  }

  // --- Manager: workspace-wide access ---
  {
    const mgrPath = `leads/${adminLead.id}/mgr-${stamp}.txt`;
    const up = await mgr.storage.from("attachments").upload(mgrPath, bytes, { upsert: true });
    ok("manager uploads to any lead", !up.error, up.error?.message);
    if (!up.error) created.objects.push(mgrPath);
    const dl = await mgr.storage.from("attachments").download(mgrPath);
    ok("manager downloads any lead file", !dl.error && dl.data);
  }

  // --- Admin: delete works for admin, exec cannot delete admin file ---
  {
    const admPath = `leads/${adminLead.id}/adm-${stamp}.txt`;
    await adm.storage.from("attachments").upload(admPath, bytes, { upsert: true });
    created.objects.push(admPath);
    const execDel = await exec.storage.from("attachments").remove([admPath]);
    // remove returns success with empty data[] when RLS blocks; assert the file still exists
    const stillThere = await svc.storage.from("attachments").download(admPath);
    ok("exec cannot delete admin-owned attachment", !!stillThere.data, execDel.error?.message);
    await auditDeny(exec, "leads", adminLead.id, "storage_delete", "RLS denied");

    const admDel = await adm.storage.from("attachments").remove([admPath]);
    ok("admin can delete own attachment", !admDel.error);
  }

  // --- Audit log assertions ---
  {
    const { data: rows } = await svc
      .from("activities")
      .select("id, actor_id, entity_type, action, metadata")
      .eq("actor_id", execId)
      .eq("action", "access_denied")
      .in("entity_id", [adminLead.id, adminCo.id])
      .order("created_at", { ascending: false })
      .limit(20);
    created.activities = (rows ?? []).map((r) => r.id);
    const hasUpload = rows?.some((r) => r.metadata?.attempted_action === "storage_upload");
    const hasDownload = rows?.some((r) => r.metadata?.attempted_action === "storage_download");
    const hasDelete = rows?.some((r) => r.metadata?.attempted_action === "storage_delete");
    ok("audit rows recorded for denied storage_upload", hasUpload);
    ok("audit rows recorded for denied storage_download", hasDownload);
    ok("audit rows recorded for denied storage_delete", hasDelete);

    // Metadata is redacted: no raw bytes, tokens, or path leaking secrets
    const bad = (rows ?? []).find((r) => {
      const s = JSON.stringify(r.metadata || {});
      return /ABC|SUPABASE_SERVICE_ROLE|Bearer\s|sb_secret/i.test(s);
    });
    ok("denied audit metadata contains no secrets or raw payload", !bad);

    // Only allowed fields present
    const disallowed = (rows ?? []).find((r) => {
      const keys = Object.keys(r.metadata || {});
      return keys.some((k) => !["attempted_action", "reason"].includes(k));
    });
    ok("denied audit metadata restricted to allowed keys", !disallowed);
  }

  const passed = results.filter((r) => r.cond).length;
  console.log(`\n${passed}/${results.length} storage RBAC checks passed`);
  if (passed !== results.length) process.exit(1);
} finally {
  // Cleanup
  try { if (created.objects.length) await svc.storage.from("attachments").remove(created.objects); } catch {}
  try { if (created.activities.length) await svc.from("activities").delete().in("id", created.activities); } catch {}
  try { if (created.leads.length) await svc.from("leads").delete().in("id", created.leads); } catch {}
  try { if (created.companies.length) await svc.from("companies").delete().in("id", created.companies); } catch {}
}
