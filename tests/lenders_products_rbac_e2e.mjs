#!/usr/bin/env node
// E2E: RLS + role-based access for lenders, loan_products, ps_products.
//
// These tables are workspace-global (no tenant_id) — pricing/commission
// data must be visible only to internal staff roles (super_admin, admin,
// sales_manager, sales_executive) and writes are further restricted.
//
// The test creates two isolated tenant workspaces plus a "no-role" user
// (an authenticated user whose auto-assigned role was revoked) and
// verifies that:
//   - all four staff roles can SELECT the three tables
//   - sales_executive cannot INSERT lenders / loan_products / ps_products
//   - sales_executive cannot DELETE ps_products
//   - the no-role user cannot SELECT or INSERT any of them
//   - a member of tenant A and a member of tenant B see the same global
//     rows (these are not tenant-scoped) but the same role gate applies
//     identically across tenants.
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

  // --- Two isolated tenants (used to prove role gate is identical across workspaces) ---
  for (const slug of [`alpha-lp-${stamp}`, `beta-lp-${stamp}`]) {
    const { data } = await svc.from("tenants").insert({
      name: slug, slug, plan: "prime", owner_id: admin.userId, is_active: true,
    }).select("id").single();
    if (data) cleanup.tenants.push(data.id);
  }
  const [tA, tB] = cleanup.tenants;
  await svc.from("tenant_members").insert([
    { tenant_id: tA, user_id: manager.userId, role: "sales_manager" },
    { tenant_id: tB, user_id: exec.userId, role: "sales_executive" },
  ]);

  // --- Seed a lender + loan product + ps_product via service role ---
  const { data: lenderRow } = await svc.from("lenders").insert({
    name: `Probe Bank ${stamp}`, lender_type: "bank",
    roi_min: 8, roi_max: 14, processing_fee_pct: 1, payout_pct: 1.5, active: true,
  }).select("id").single();
  cleanup.lenders.push(lenderRow.id);
  const { data: prodRow } = await svc.from("loan_products").insert({
    lender_id: lenderRow.id, name: `Probe PL ${stamp}`, product_type: "personal",
    min_amount: 10000, max_amount: 500000, max_tenure_months: 60,
    roi_min: 10, roi_max: 18, payout_pct: 1.2, active: true,
  }).select("id").single();
  cleanup.products.push(prodRow.id);
  const { data: psRow } = await svc.from("ps_products").insert({
    sku: `SKU-${stamp}`, name: `Probe SKU ${stamp}`, price: 999, cost: 500,
    stock: 10, commission_pct: 5, active: true, owner_id: admin.userId,
  }).select("id").single();
  cleanup.psProducts.push(psRow.id);

  // --- Staff SELECT: all three staff test users see the seeded rows ---
  for (const [label, u] of [["admin", admin], ["manager (tenant A)", manager], ["exec (tenant B)", exec]]) {
    for (const [tbl, id] of [["lenders", lenderRow.id], ["loan_products", prodRow.id], ["ps_products", psRow.id]]) {
      const { data, error } = await u.client.from(tbl).select("id").eq("id", id).maybeSingle();
      check(`[${label}] SELECT ${tbl} row visible`, !error && data?.id === id, error?.message ?? String(data));
    }
  }

  // --- Exec cannot INSERT lenders / loan_products / ps_products ---
  {
    const { error: e1 } = await exec.client.from("lenders").insert({
      name: `x-${stamp}`, lender_type: "bank", roi_min: 1, roi_max: 2, processing_fee_pct: 0, payout_pct: 0, active: true,
    });
    check("[exec] INSERT lenders blocked", !!e1, e1?.message ?? "no error");
    const { error: e2 } = await exec.client.from("loan_products").insert({
      lender_id: lenderRow.id, name: `x-${stamp}`, product_type: "personal",
      min_amount: 1, max_amount: 2, max_tenure_months: 12, roi_min: 1, roi_max: 2, payout_pct: 0, active: true,
    });
    check("[exec] INSERT loan_products blocked", !!e2, e2?.message ?? "no error");
    const { error: e3 } = await exec.client.from("ps_products").insert({
      sku: `X-${stamp}`, name: "x", price: 1, cost: 1, stock: 0, commission_pct: 0, active: true, owner_id: exec.userId,
    });
    check("[exec] INSERT ps_products blocked", !!e3, e3?.message ?? "no error");
    const { error: e4 } = await exec.client.from("ps_products").delete().eq("id", psRow.id);
    const { data: still } = await svc.from("ps_products").select("id").eq("id", psRow.id).maybeSingle();
    check("[exec] DELETE ps_products blocked", !!e4 || !!still, e4?.message ?? "row survived");
  }

  // --- Manager CAN insert lenders/products (positive control) ---
  {
    const { data, error } = await manager.client.from("lenders").insert({
      name: `mgr-${stamp}`, lender_type: "nbfc", roi_min: 5, roi_max: 9, processing_fee_pct: 0.5, payout_pct: 1, active: true,
    }).select("id").single();
    check("[manager] INSERT lenders allowed", !error && !!data?.id, error?.message ?? "");
    if (data?.id) cleanup.lenders.push(data.id);
  }

  // --- No-role user: authenticated but has zero roles ---
  const noRoleEmail = `norole-${stamp}@digicrm.test`;
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email: noRoleEmail, password: PWD, email_confirm: true,
  });
  if (cErr) throw new Error(`create no-role user: ${cErr.message}`);
  cleanup.users.push(created.user.id);
  // handle_new_user auto-assigns a role — strip it.
  await svc.from("user_roles").delete().eq("user_id", created.user.id);
  const noRole = await signedIn(noRoleEmail);
  for (const tbl of ["lenders", "loan_products", "ps_products"]) {
    const { data, error } = await noRole.client.from(tbl).select("id").limit(5);
    check(`[no-role] SELECT ${tbl} returns 0 rows`, !error && Array.isArray(data) && data.length === 0,
      error?.message ?? `rows=${data?.length}`);
  }
  {
    const { error } = await noRole.client.from("ps_products").insert({
      sku: `NR-${stamp}`, name: "nr", price: 1, cost: 1, stock: 0, commission_pct: 0, active: true, owner_id: noRole.userId,
    });
    check("[no-role] INSERT ps_products blocked", !!error, error?.message ?? "no error");
  }
} finally {
  for (const id of cleanup.products) await svc.from("loan_products").delete().eq("id", id);
  for (const id of cleanup.lenders) await svc.from("lenders").delete().eq("id", id);
  for (const id of cleanup.psProducts) await svc.from("ps_products").delete().eq("id", id);
  for (const id of cleanup.tenants) await svc.from("tenants").delete().eq("id", id);
  for (const id of cleanup.users) await svc.auth.admin.deleteUser(id).catch(() => {});
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} lenders/products RBAC checks passed`);
if (passed !== results.length) process.exit(1);
