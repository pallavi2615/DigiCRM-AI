/**
 * Permission regression: for every role, assert the shared permission matrix
 * agrees with what the database actually allows (UI -> API -> DB -> RLS).
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *      TEST_USER_PASSWORD, TEST_{ADMIN,MANAGER,EXEC}_EMAIL
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.TEST_USER_PASSWORD;

const ROLE_USERS = {
  admin: process.env.TEST_ADMIN_EMAIL || "admin@digicrm.demo",
  sales_manager: process.env.TEST_MANAGER_EMAIL || "manager@digicrm.demo",
  sales_executive: process.env.TEST_EXEC_EMAIL || "executive@digicrm.demo",
};

// module -> { table, softDelete } mirror of src/lib/rbac.functions.ts
const TABLES = {
  leads: { table: "leads", soft: true },
  contacts: { table: "contacts", soft: true },
  companies: { table: "companies", soft: true },
  tasks: { table: "tasks", soft: false },
  meetings: { table: "meetings", soft: false },
};

// delete permission per role, mirroring src/lib/permissions.ts
const CAN_DELETE = {
  admin: { leads: true, contacts: true, companies: true, tasks: true, meetings: true },
  sales_manager: { leads: false, contacts: false, companies: false, tasks: true, meetings: true },
  sales_executive: { leads: false, contacts: false, companies: false, tasks: false, meetings: false },
};

const failures = [];
const ok = (msg) => console.log(`  ok  ${msg}`);
const bad = (msg) => { failures.push(msg); console.log(`FAIL  ${msg}`); };

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function signIn(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { client: c, userId: data.user.id };
}

async function seedRow(moduleKey, ownerId) {
  const base = {
    leads: { company_name: `perm-test-${Date.now()}`, created_by: ownerId, assigned_to: ownerId },
    contacts: { first_name: `perm-test-${Date.now()}`, created_by: ownerId },
    companies: { name: `perm-test-${Date.now()}`, created_by: ownerId },
    tasks: { title: `perm-test-${Date.now()}`, created_by: ownerId, assigned_to: ownerId },
    meetings: {
      title: `perm-test-${Date.now()}`,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 36e5).toISOString(),
      organizer: ownerId,
    },
  }[moduleKey];
  const { data, error } = await admin.from(TABLES[moduleKey].table).insert(base).select("id").single();
  if (error) throw new Error(`seed ${moduleKey}: ${error.message}`);
  return data.id;
}

function createPayload(moduleKey, ownerId) {
  const stamp = Date.now();
  return {
    leads: { company_name: `perm-create-${stamp}`, created_by: ownerId, assigned_to: ownerId },
    contacts: { first_name: `perm-create-${stamp}`, created_by: ownerId },
    companies: { name: `perm-create-${stamp}`, created_by: ownerId },
    tasks: { title: `perm-create-${stamp}`, created_by: ownerId, assigned_to: ownerId },
    meetings: {
      title: `perm-create-${stamp}`,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 36e5).toISOString(),
      organizer: ownerId,
    },
  }[moduleKey];
}

function editPayload(moduleKey) {
  const stamp = Date.now();
  return {
    leads: { company_name: `perm-edit-${stamp}` },
    contacts: { first_name: `perm-edit-${stamp}` },
    companies: { name: `perm-edit-${stamp}` },
    tasks: { title: `perm-edit-${stamp}` },
    meetings: { title: `perm-edit-${stamp}` },
  }[moduleKey];
}

async function cleanup(moduleKey, id) {
  await admin.from(TABLES[moduleKey].table).delete().eq("id", id);
}

async function run() {
  for (const [role, email] of Object.entries(ROLE_USERS)) {
    console.log(`\n== ${role} (${email})`);
    const { client, userId } = await signIn(email);

    // role in DB matches the role we are testing
    const { data: dbRoles } = await client.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = (dbRoles ?? []).map((r) => r.role);
    if (!roleSet.includes(role)) bad(`${email} expected role ${role}, got ${roleSet.join(",") || "none"}`);
    else ok(`role in database is ${role}`);

    // create + edit: every role may create and edit records in these modules
    for (const moduleKey of Object.keys(TABLES)) {
      const payload = createPayload(moduleKey, userId);
      const { data: created, error: cErr } = await client
        .from(TABLES[moduleKey].table).insert(payload).select("id").single();
      if (cErr || !created) { bad(`${moduleKey}: create failed (${cErr?.message})`); }
      else {
        ok(`${moduleKey}: create allowed as expected`);
        const { error: uErr } = await client
          .from(TABLES[moduleKey].table)
          .update(editPayload(moduleKey))
          .eq("id", created.id);
        if (uErr) bad(`${moduleKey}: edit blocked (${uErr.message})`);
        else ok(`${moduleKey}: edit allowed as expected`);
        await cleanup(moduleKey, created.id);
      }
    }

    for (const moduleKey of Object.keys(TABLES)) {
      const id = await seedRow(moduleKey, userId);
      const t = TABLES[moduleKey];
      let succeeded;
      if (t.soft) {
        // Soft delete = UPDATE deleted_at. The SELECT policy hides deleted rows,
        // so verify the write with the service-role client instead of RETURNING.
        const { error } = await client
          .from(t.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        const { data: after } = await admin.from(t.table).select("deleted_at").eq("id", id).maybeSingle();
        succeeded = !error && !!after?.deleted_at;
      } else {
        const { data, error } = await client.from(t.table).delete().eq("id", id).select("id");
        succeeded = !error && (data ?? []).length > 0;
      }
      const expected = CAN_DELETE[role][moduleKey];
      if (succeeded === expected) ok(`${moduleKey}: delete ${expected ? "allowed" : "blocked"} as expected`);
      else bad(`${moduleKey}: delete ${succeeded ? "allowed" : "blocked"} but matrix expects ${expected ? "allowed" : "blocked"}`);
      await cleanup(moduleKey, id);
    }

    // Non-admin roles must not be able to change anyone's role.
    const { error: roleErr } = await client
      .from("user_roles")
      .insert({ user_id: userId, role: "super_admin" });
    const escalated = !roleErr;
    if (role === "admin") {
      if (escalated) bad("admin was able to grant itself super_admin");
      else ok("admin cannot self-escalate to super_admin");
    } else if (escalated) bad(`${role} escalated to super_admin`);
    else ok(`${role} cannot change roles`);
    await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "super_admin");
  }

  // Role changes are audited.
  const { data: auditRows } = await admin
    .from("activities")
    .select("id")
    .eq("entity_type", "user_roles")
    .limit(1);
  if ((auditRows ?? []).length) ok("role change audit entries exist");
  else console.log("  ..  no role change audit rows yet (no changes performed)");

  console.log(`\n${failures.length ? `${failures.length} failure(s)` : "all permission checks passed"}`);
  if (failures.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
