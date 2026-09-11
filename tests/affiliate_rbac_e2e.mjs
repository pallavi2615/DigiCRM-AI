#!/usr/bin/env node
// E2E: affiliate RBAC
// - anon can INSERT application (public join form)
// - admin can approve, reject, update, delete
// - manager & executive: cannot update/delete/approve
// - non-owner user cannot read other affiliate rows
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
  return c;
}

const stamp = Date.now();
const created = [];

try {
  // 1. Anon can apply (public insert)
  const anonEmail = `anon-${stamp}@e2e.test`;
  const { error: applyErr } = await anon.from("affiliates").insert({
    name: `Anon Applicant ${stamp}`,
    email: anonEmail,
    company: "Anon Co",
    audience: "SMB owners",
  });
  check("anon can submit affiliate application", !applyErr, applyErr?.message);
  const { data: app1 } = await svc.from("affiliates").select("id").eq("email", anonEmail).maybeSingle();
  if (app1?.id) created.push(app1.id);
  check("submitted application persisted", !!app1?.id);

  // 2. Anon cannot read affiliates
  const { data: leaked } = await anon.from("affiliates").select("id").limit(5);
  check("anon cannot read affiliates list", !leaked || leaked.length === 0);

  // Create an extra pending row via service for admin actions
  const { data: pending } = await svc.from("affiliates").insert({
    name: `Pending ${stamp}`, email: `pending-${stamp}@e2e.test`,
  }).select("id").single();
  created.push(pending.id);

  // 3. Admin can approve
  const admin = await signedIn(EMAILS.admin);
  const { error: approveErr } = await admin.from("affiliates").update({
    status: "approved", approved_at: new Date().toISOString(),
    referral_code: `E2E${stamp}`.slice(0, 20),
  }).eq("id", pending.id);
  check("admin can approve affiliate", !approveErr, approveErr?.message);

  // 4. Admin can reject another
  const { data: pend2 } = await svc.from("affiliates").insert({
    name: `Pending2 ${stamp}`, email: `pending2-${stamp}@e2e.test`,
  }).select("id").single();
  created.push(pend2.id);
  const { error: rejErr } = await admin.from("affiliates").update({ status: "rejected" }).eq("id", pend2.id);
  check("admin can reject affiliate", !rejErr, rejErr?.message);

  // 5. Admin can read all
  const { data: adminList } = await admin.from("affiliates").select("id").in("id", created);
  check("admin sees all affiliates", (adminList?.length ?? 0) === created.length);

  // 6. Manager cannot approve/update
  const manager = await signedIn(EMAILS.manager);
  const { error: mgrUpdErr, data: mgrUpd } = await manager.from("affiliates")
    .update({ status: "approved" }).eq("id", app1.id).select("id");
  check("manager blocked from updating affiliates", !!mgrUpdErr || !mgrUpd || mgrUpd.length === 0);

  // 7. Manager cannot delete
  const { error: mgrDelErr, data: mgrDel } = await manager.from("affiliates")
    .delete().eq("id", app1.id).select("id");
  check("manager blocked from deleting affiliates", !!mgrDelErr || !mgrDel || mgrDel.length === 0);

  // 8. Manager cannot read other affiliates (only own via user_id link)
  const { data: mgrList } = await manager.from("affiliates").select("id").in("id", created);
  check("manager cannot read admin-owned affiliates", !mgrList || mgrList.length === 0);

  // 9. Executive cannot update/delete/read
  const exec = await signedIn(EMAILS.exec);
  const { error: exUpdErr, data: exUpd } = await exec.from("affiliates")
    .update({ status: "approved" }).eq("id", app1.id).select("id");
  check("executive blocked from updating affiliates", !!exUpdErr || !exUpd || exUpd.length === 0);
  const { data: exList } = await exec.from("affiliates").select("id").in("id", created);
  check("executive cannot read affiliates list", !exList || exList.length === 0);
  const { error: exDelErr, data: exDel } = await exec.from("affiliates")
    .delete().eq("id", app1.id).select("id");
  check("executive blocked from deleting affiliates", !!exDelErr || !exDel || exDel.length === 0);

  // 10. Admin CRUD: delete
  const { data: pend3 } = await svc.from("affiliates").insert({
    name: `Deletable ${stamp}`, email: `del-${stamp}@e2e.test`,
  }).select("id").single();
  const { error: adminDelErr } = await admin.from("affiliates").delete().eq("id", pend3.id);
  check("admin can delete affiliate", !adminDelErr, adminDelErr?.message);
} catch (err) {
  check("no exceptions", false, err.message);
} finally {
  if (created.length) await svc.from("affiliates").delete().in("id", created);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
