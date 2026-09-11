/**
 * Affiliate partner portal — server functions.
 *
 * A partner may only ever see their OWN referral earnings. The caller is
 * resolved from the bearer token, matched to an approved affiliate row, and
 * only then are the referred leads aggregated per tenant with the admin
 * client (leads themselves stay invisible to partners).
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PayoutRow = {
  tenantId: string | null;
  tenantName: string;
  referrals: number;
  wonReferrals: number;
  baseAmount: number;
  earned: number;
  requested: number;
  paid: number;
  payable: number;
};

export type PartnerSummary = {
  affiliate: {
    id: string;
    name: string;
    email: string;
    status: string;
    referralCode: string | null;
    commissionPct: number;
    payoutMethod: string | null;
  } | null;
  rows: PayoutRow[];
  totals: { earned: number; requested: number; paid: number; payable: number; referrals: number };
};

type UserClient = { from: (t: string) => any };

async function computeSummary(userClient: UserClient, userId: string): Promise<PartnerSummary> {
    const empty: PartnerSummary = {
      affiliate: null,
      rows: [],
      totals: { earned: 0, requested: 0, paid: 0, payable: 0, referrals: 0 },
    };

    const { data: aff } = await userClient
      .from("affiliates")
      .select("id, name, email, status, referral_code, commission_pct, payout_method")
      .eq("user_id", userId)
      .maybeSingle();

    if (!aff) return empty;

    const affiliate = {
      id: aff.id as string,
      name: (aff.name as string) ?? "",
      email: (aff.email as string) ?? "",
      status: (aff.status as string) ?? "pending",
      referralCode: (aff.referral_code as string | null) ?? null,
      commissionPct: Number(aff.commission_pct ?? 20),
      payoutMethod: (aff.payout_method as string | null) ?? null,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: leads }, { data: comms }, { data: reqs }, { data: tenants }] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select("id, tenant_id, status, estimated_value")
        .eq("affiliate_id", affiliate.id),
      supabaseAdmin
        .from("affiliate_commissions")
        .select("lead_id, base_amount, commission_amount, status")
        .eq("affiliate_id", affiliate.id),
      supabaseAdmin
        .from("affiliate_payout_requests")
        .select("tenant_id, amount, status")
        .eq("affiliate_id", affiliate.id),
      supabaseAdmin.from("tenants").select("id, name"),
    ]);

    const tenantName = new Map<string, string>(
      (tenants ?? []).map((t) => [t.id as string, (t.name as string) ?? "Workspace"]),
    );
    const leadTenant = new Map<string, string | null>(
      (leads ?? []).map((l) => [l.id as string, (l.tenant_id as string | null) ?? null]),
    );

    const bucket = new Map<string, PayoutRow>();
    const rowFor = (tenantId: string | null) => {
      const key = tenantId ?? "__none__";
      let row = bucket.get(key);
      if (!row) {
        row = {
          tenantId,
          tenantName: tenantId ? (tenantName.get(tenantId) ?? "Workspace") : "Direct / unassigned",
          referrals: 0,
          wonReferrals: 0,
          baseAmount: 0,
          earned: 0,
          requested: 0,
          paid: 0,
          payable: 0,
        };
        bucket.set(key, row);
      }
      return row;
    };

    for (const l of leads ?? []) {
      const row = rowFor((l.tenant_id as string | null) ?? null);
      row.referrals += 1;
      if (l.status === "won") row.wonReferrals += 1;
    }

    for (const c of comms ?? []) {
      if (c.status === "cancelled") continue;
      const row = rowFor(leadTenant.get(c.lead_id as string) ?? null);
      row.baseAmount += Number(c.base_amount ?? 0);
      row.earned += Number(c.commission_amount ?? 0);
    }

    for (const r of reqs ?? []) {
      const row = rowFor((r.tenant_id as string | null) ?? null);
      const amt = Number(r.amount ?? 0);
      if (r.status === "paid") row.paid += amt;
      else if (r.status === "requested" || r.status === "approved") row.requested += amt;
    }

    const rows = [...bucket.values()].map((r) => ({
      ...r,
      payable: Math.max(0, r.earned - r.requested - r.paid),
    }));
    rows.sort((a, b) => b.earned - a.earned);

    const totals = rows.reduce(
      (acc, r) => ({
        earned: acc.earned + r.earned,
        requested: acc.requested + r.requested,
        paid: acc.paid + r.paid,
        payable: acc.payable + r.payable,
        referrals: acc.referrals + r.referrals,
      }),
      { earned: 0, requested: 0, paid: 0, payable: 0, referrals: 0 },
    );

    return { affiliate, rows, totals };
}

export const getPartnerSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PartnerSummary> =>
    computeSummary(context.supabase as unknown as UserClient, context.userId),
  );

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string | null; amount: number; method: string; notes?: string }) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter an amount above zero");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: aff } = await context.supabase
      .from("affiliates")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!aff || aff.status !== "approved") throw new Error("Only approved partners can request a payout");

    const summary = await computeSummary(context.supabase as unknown as UserClient, context.userId);
    const row = summary.rows.find((r) => (r.tenantId ?? null) === (data.tenantId ?? null));
    const payable = row?.payable ?? 0;
    if (data.amount > payable + 0.01) {
      throw new Error(`You can request up to ₹${Math.round(payable).toLocaleString("en-IN")} for this workspace`);
    }

    const { error } = await context.supabase.from("affiliate_payout_requests").insert({
      affiliate_id: aff.id,
      tenant_id: data.tenantId,
      amount: data.amount,
      method: data.method,
      notes: data.notes ?? null,
      status: "requested",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
