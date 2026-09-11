#!/usr/bin/env node
// E2E: role-based UPDATE and DELETE for lenders, loan_products, ps_products
// across two tenants.
//
// These tables are workspace-global (no tenant_id column) — pricing/payout/
// cost data is shared across tenants but write access is gated by role:
//   - super_admin / admin    : may UPDATE and DELETE all three tables
//   - sales_manager          : may UPDATE lenders + loan_products + ps_products,
//                              but NOT DELETE ps_products (admin-only) or lenders
//   - sales_executive        : may not UPDATE or DELETE any of them
//   - no-role authenticated  : may not UPDATE or DELETE any of them
//
// We prove the role gate is identical when the same caller is switched
// between two tenants (tenant A vs tenant B) by re-running the write probe
// after flipping the caller's active tenant_members row.
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
const cleanup = { tenants: [], lenders: [], products: [], psProducts: [], users: [] };

try {
  const admin = await signedIn(EMAILS.admin);
  const manager = await signedIn(EMAILS.manager);
  const exec = await signedIn(EMAILS.exec);

  // Two isolated tenants.
  for (const slug of [`alpha-w-${stamp}`, `beta-w-${stamp}`]) {
    const { data } = await svc.from("tenants").insert({
      name: slug, slug, plan: "prime", owner_id: admin.userId, is_active: true,
    }).select("id").single();
    if (data) cleanup.tenants.push(data.id);
  }
  const [tA, tB] = cleanup.tenants;
  // Manager starts in tenant A; exec starts in tenant B.
  await svc.from("tenant_members").insert([
    { tenant_id: tA, user_id: manager.userId, role: "sales_manager" },
    { tenant_id: tB, user_id: exec.userId, role: "sales_executive" },
  ]);

  // Seed rows via service role.
  const { data: lenderRow } = await svc.from("lenders").insert({
    name: `Write Bank ${stamp}`, lender_type: "bank",
    roi_min: 8, roi_max: 14, processing_fee_pct: 1, payout_pct: 1.5, active: true,
  }).select("id").single();
  cleanup.lenders.push(lenderRow.id);
  const { data: prodRow } = await svc.from("loan_products").insert({
    lender_id: lenderRow.id, name: `Write PL ${stamp}`, product_type: "personal",
    min_amount: 10000, max_amount: 500000, max_tenure_months: 60,
    roi_min: 10, roi_max: 18, payout_pct: 1.2, active: true,
  }).select("id").single();
  cleanup.products.push(prodRow.id);
  const { data: psRow } = await svc.from("ps_products").insert({
    sku: `WS-${stamp}`, name: `Write SKU ${stamp}`, price: 999, cost: 500,
    stock: 10, commission_pct: 5, active: true, owner_id: admin.userId,
  }).select("id").single();
  cleanup.psProducts.push(psRow.id);

  const isSurvivor = async (tbl, id) => {
    const { data } = await svc.from(tbl).select("id").eq("id", id).maybeSingle();
    return !!data?.id;
  };
  const currentValue = async (tbl, id, col) => {
    const { data } = await svc.from(tbl).select(col).eq("id", id).maybeSingle();
    return data?.[col];
  };

  // ---------- UPDATE probes ----------
  // Executive cannot UPDATE any of the three (writes silently return 0 rows
  // under RLS; we assert the value did not change).
  {
    const before = await currentValue("lenders", lenderRow.id, "payout_pct");
    await exec.client.from("lenders").update({ payout_pct: 99 }).eq("id", lenderRow.id);
    const after = await currentValue("lenders", lenderRow.id, "payout_pct");
    check("[exec] UPDATE lenders blocked (payout_pct unchanged)", Number(after) === Number(before), `before=${before} after=${after}`);
  }
  {
    const before = await currentValue("loan_products", prodRow.id, "payout_pct");
    await exec.client.from("loan_products").update({ payout_pct: 99 }).eq("id", prodRow.id);
    const after = await currentValue("loan_products", prodRow.id, "payout_pct");
    check("[exec] UPDATE loan_products blocked (payout_pct unchanged)", Number(after) === Number(before), `before=${before} after=${after}`);
  }
  {
    const before = await currentValue("ps_products", psRow.id, "cost");
    await exec.client.from("ps_products").update({ cost: 1 }).eq("id", psRow.id);
    const after = await currentValue("ps_products", psRow.id, "cost");
    check("[exec] UPDATE ps_products blocked (cost unchanged)", Number(after) === Number(before), `before=${before} after=${after}`);
  }

  // Manager CAN update all three (positive control).
  {
    const { error } = await manager.client.from("lenders").update({ payout_pct: 2.0 }).eq("id", lenderRow.id);
    const after = await currentValue("lenders", lenderRow.id, "payout_pct");
    check("[manager] UPDATE lenders allowed", !error && Number(after) === 2.0, error?.message ?? `after=${after}`);
  }
  {
    const { error } = await manager.client.from("loan_products").update({ payout_pct: 1.5 }).eq("id", prodRow.id);
    const after = await currentValue("loan_products", prodRow.id, "payout_pct");
    check("[manager] UPDATE loan_products allowed", !error && Number(after) === 1.5, error?.message ?? `after=${after}`);
  }
  {
    const { error } = await manager.client.from("ps_products").update({ cost: 600 }).eq("id", psRow.id);
    const after = await currentValue("ps_products", psRow.id, "cost");
    check("[manager] UPDATE ps_products allowed", !error && Number(after) === 600, error?.message ?? `after=${after}`);
  }

  // ---------- Cross-tenant probe: flip manager into tenant B and re-verify ----------
  await svc.from("tenant_members").delete().eq("user_id", manager.userId);
  await svc.from("tenant_members").insert({ tenant_id: tB, user_id: manager.userId, role: "sales_manager" });
  {
    // Still a sales_manager (workspace role is global via user_roles), so
    // writes should still succeed regardless of active tenant membership.
    const { error } = await manager.client.from("lenders").update({ payout_pct: 2.5 }).eq("id", lenderRow.id);
    const after = await currentValue("lenders", lenderRow.id, "payout_pct");
    check("[manager in tenant B] UPDATE lenders still allowed", !error && Number(after) === 2.5, error?.message ?? `after=${after}`);
  }
  // And exec flipped into tenant A must remain blocked.
  await svc.from("tenant_members").delete().eq("user_id", exec.userId);
  await svc.from("tenant_members").insert({ tenant_id: tA, user_id: exec.userId, role: "sales_executive" });
  {
    const before = await currentValue("ps_products", psRow.id, "cost");
    await exec.client.from("ps_products").update({ cost: 1 }).eq("id", psRow.id);
    const after = await currentValue("ps_products", psRow.id, "cost");
    check("[exec in tenant A] UPDATE ps_products still blocked", Number(after) === Number(before), `before=${before} after=${after}`);
  }

  // ---------- DELETE probes ----------
  // Manager CANNOT delete lenders (admin-only DELETE policy).
  {
    const { error } = await manager.client.from("lenders").delete().eq("id", lenderRow.id);
    const survived = await isSurvivor("lenders", lenderRow.id);
    check("[manager] DELETE lenders blocked", survived, error?.message ?? "row survived");
  }
  // Manager CAN delete loan_products (ALL policy for staff).
  {
    const { data: extra } = await svc.from("loan_products").insert({
      lender_id: lenderRow.id, name: `mgr-del-${stamp}`, product_type: "personal",
      min_amount: 1, max_amount: 2, max_tenure_months: 12, roi_min: 1, roi_max: 2, payout_pct: 0, active: true,
    }).select("id").single();
    cleanup.products.push(extra.id);
    const { error } = await manager.client.from("loan_products").delete().eq("id", extra.id);
    const survived = await isSurvivor("loan_products", extra.id);
    check("[manager] DELETE loan_products allowed", !error && !survived, error?.message ?? "row survived");
  }
  // Manager CANNOT delete ps_products (admin-only DELETE policy).
  {
    const { error } = await manager.client.from("ps_products").delete().eq("id", psRow.id);
    const survived = await isSurvivor("ps_products", psRow.id);
    check("[manager] DELETE ps_products blocked", survived, error?.message ?? "row survived");
  }
  // Admin CAN delete a lender (positive control) — reseed then delete.
  {
    const { data: extra } = await svc.from("lenders").insert({
      name: `admin-del-${stamp}`, lender_type: "bank", roi_min: 1, roi_max: 2,
      processing_fee_pct: 0, payout_pct: 0, active: true,
    }).select("id").single();
    cleanup.lenders.push(extra.id);
    const { error } = await admin.client.from("lenders").delete().eq("id", extra.id);
    const survived = await isSurvivor("lenders", extra.id);
    check("[admin] DELETE lenders allowed", !error && !survived, error?.message ?? "row survived");
  }

  // ---------- No-role user ----------
  const noRoleEmail = `norole-w-${stamp}@digicrm.test`;
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email: noRoleEmail, password: PWD, email_confirm: true,
  });
  if (cErr) throw new Error(`create no-role user: ${cErr.message}`);
  cleanup.users.push(created.user.id);
  await svc.from("user_roles").delete().eq("user_id", created.user.id);
  const noRole = await signedIn(noRoleEmail);
  for (const [tbl, id, col] of [
    ["lenders", lenderRow.id, "payout_pct"],
    ["loan_products", prodRow.id, "payout_pct"],
    ["ps_products", psRow.id, "cost"],
  ]) {
    const before = await currentValue(tbl, id, col);
    await noRole.client.from(tbl).update({ [col]: 0 }).eq("id", id);
    const after = await currentValue(tbl, id, col);
    check(`[no-role] UPDATE ${tbl} blocked`, Number(after) === Number(before), `before=${before} after=${after}`);
    const { error } = await noRole.client.from(tbl).delete().eq("id", id);
    const survived = await isSurvivor(tbl, id);
    check(`[no-role] DELETE ${tbl} blocked`, survived, error?.message ?? "row survived");
  }
} finally {
  for (const id of cleanup.products) await svc.from("loan_products").delete().eq("id", id);
  for (const id of cleanup.lenders) await svc.from("lenders").delete().eq("id", id);
  for (const id of cleanup.psProducts) await svc.from("ps_products").delete().eq("id", id);
  for (const id of cleanup.tenants) await svc.from("tenants").delete().eq("id", id);
  for (const id of cleanup.users) await svc.auth.admin.deleteUser(id).catch(() => {});
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} lenders/products WRITE RBAC checks passed`);
if (passed !== results.length) process.exit(1);
