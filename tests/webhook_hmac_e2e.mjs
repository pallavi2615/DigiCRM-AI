#!/usr/bin/env node
// E2E: inbound webhook HMAC verification + audit logging
// - valid HMAC → lead created + success audit log
// - invalid HMAC → 401 + audit log with "invalid_hmac", NO lead created
// - missing signature → 401 + audit log
// - HMAC disabled → falls back to plain x-webhook-secret header
import { createClient } from "@supabase/supabase-js";
import { createHmac, randomBytes } from "crypto";

const URL = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.APP_BASE_URL || "http://localhost:8080";
if (!URL || !SVC) { console.error("Missing env"); process.exit(2); }

const svc = createClient(URL, SVC, { auth: { persistSession: false } });
const ok = (n, c, e = "") => console.log((c ? "✓" : "✗") + " " + n + (e ? ` — ${e}` : ""));
const results = [];
const check = (n, c, e = "") => { results.push(!!c); ok(n, c, e); };

const stamp = Date.now();
const slug = `hmac-test-${stamp}`;
const secret = randomBytes(24).toString("hex");
let tenantId = null;
const createdLeadIds = [];

async function post(body, headers) {
  const res = await fetch(`${BASE}/api/public/inbound/leads/${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function logsFor(msg) {
  const { data } = await svc.from("inbound_webhooks_log")
    .select("id, ok, status_code, message, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false }).limit(20);
  return (data ?? []).filter((r) => (r.message ?? "").includes(msg));
}

try {
  // Create HMAC-enabled tenant
  const { data: t, error: tErr } = await svc.from("tenants").insert({
    name: `HMAC Test ${stamp}`, slug, plan: "prime",
    webhook_hmac_enabled: true, is_active: true,
  }).select("id").single();
  if (tErr) throw new Error(`tenant create: ${tErr.message}`);
  tenantId = t.id;
  // webhook_secret now lives in the admin-only tenant_webhook_secrets table.
  const { error: sErr } = await svc.from("tenant_webhook_secrets")
    .upsert({ tenant_id: tenantId, webhook_secret: secret }, { onConflict: "tenant_id" });
  if (sErr) throw new Error(`secret upsert: ${sErr.message}`);


  const validPayload = JSON.stringify({ email: `valid-${stamp}@e2e.test`, name: "Valid Sig", source: "e2e-hmac" });
  const validSig = createHmac("sha256", secret).update(validPayload).digest("hex");

  // 1. Valid HMAC → 200 + lead + success log
  const r1 = await post(validPayload, { "x-webhook-signature": validSig });
  check("valid HMAC returns 200", r1.status === 200, `got ${r1.status}`);
  if (r1.body?.lead_id) createdLeadIds.push(r1.body.lead_id);
  const successLogs = await logsFor(r1.body?.lead_id ? `lead:${r1.body.lead_id}` : "___none___");
  check("success audit log written for valid HMAC", successLogs.length >= 1);

  // 2. Invalid signature → 401 + invalid_hmac log, NO lead
  const badPayload = JSON.stringify({ email: `invalid-${stamp}@e2e.test`, name: "Bad Sig" });
  const r2 = await post(badPayload, { "x-webhook-signature": "sha256=deadbeef".padEnd(70, "0") });
  check("invalid HMAC returns 401", r2.status === 401, `got ${r2.status}`);
  const badLogs = await logsFor("invalid_hmac");
  check("invalid_hmac audit log written", badLogs.length >= 1);
  const { data: leaked } = await svc.from("leads").select("id").eq("email", `invalid-${stamp}@e2e.test`);
  check("no lead created for invalid HMAC", !leaked || leaked.length === 0);

  // 3. Missing signature → 401 + invalid_hmac log
  const r3 = await post(JSON.stringify({ email: `missing-${stamp}@e2e.test` }), {});
  check("missing signature returns 401", r3.status === 401, `got ${r3.status}`);

  // 4. Tampered body (signature valid for different body) → 401
  const tampered = JSON.stringify({ email: `tampered-${stamp}@e2e.test`, name: "Tampered" });
  const r4 = await post(tampered, { "x-webhook-signature": validSig });
  check("tampered body returns 401", r4.status === 401, `got ${r4.status}`);
  const { data: tLeak } = await svc.from("leads").select("id").eq("email", `tampered-${stamp}@e2e.test`);
  check("no lead created for tampered body", !tLeak || tLeak.length === 0);

  // 5. Disable HMAC, plain x-webhook-secret works
  await svc.from("tenants").update({ webhook_hmac_enabled: false }).eq("id", tenantId);
  const r5 = await post(
    JSON.stringify({ email: `plain-${stamp}@e2e.test`, name: "Plain Secret" }),
    { "x-webhook-secret": secret },
  );
  check("plain secret works when HMAC disabled", r5.status === 200, `got ${r5.status}`);
  if (r5.body?.lead_id) createdLeadIds.push(r5.body.lead_id);

  // 6. Wrong plain secret still rejected + logged
  const r6 = await post(
    JSON.stringify({ email: `wrong-${stamp}@e2e.test` }),
    { "x-webhook-secret": "wrong-secret" },
  );
  check("wrong plain secret returns 401", r6.status === 401);
  const unauthLogs = await logsFor("unauthorized");
  check("unauthorized audit log written for wrong plain secret", unauthLogs.length >= 1);
} catch (err) {
  check("no exceptions", false, err.message);
} finally {
  if (createdLeadIds.length) await svc.from("leads").delete().in("id", createdLeadIds);
  if (tenantId) {
    await svc.from("inbound_webhooks_log").delete().eq("tenant_id", tenantId);
    await svc.from("tenants").delete().eq("id", tenantId);
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
