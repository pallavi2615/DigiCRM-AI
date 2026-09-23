import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/lib/queries/tenants";
import { useAllPacks } from "@/lib/pack-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, Handshake, Loader2, Receipt, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tenant-billing")({
  head: () => ({
    meta: [
      { title: "Workspace Billing | DigiCRM AI" },
      { name: "description", content: "Revenue by industry pack, lead conversions and partner payouts for your own workspace." },
      { property: "og:title", content: "Workspace Billing | DigiCRM AI" },
      { property: "og:description", content: "Pack revenue, conversions and affiliate payouts scoped to your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TenantBilling,
});

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function Kpi({ title, value, hint, icon: Icon }: {
  title: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1.5">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function TenantBilling() {
  const { active, loading } = useActiveTenant();
  const { packs } = useAllPacks();
  const tenantId = active?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-billing", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [recordsRes, leadsRes, settingsRes] = await Promise.all([
        supabase
          .from("pack_records")
          .select("id, group_slug, pack_slug, stage, value, won, created_at")
          .eq("tenant_id", tenantId!),
        supabase
          .from("leads")
          .select("id, status, estimated_value")
          .eq("tenant_id", tenantId!)
          .is("deleted_at", null),
        supabase.from("affiliate_settings").select("default_commission_pct").limit(1).maybeSingle(),
      ]);
      const records = recordsRes.data ?? [];
      const ids = records.map((r) => r.id);
      let payments: { amount: number; status: string; record_id: string; label: string; paid_at: string | null }[] = [];
      if (ids.length) {
        const { data: pay } = await supabase
          .from("pack_payments")
          .select("amount, status, record_id, label, paid_at")
          .in("record_id", ids);
        payments = pay ?? [];
      }
      return {
        records,
        leads: leadsRes.data ?? [],
        payments,
        commissionPct: Number(settingsRes.data?.default_commission_pct ?? 20),
      };
    },
  });

  const view = useMemo(() => {
    const records = data?.records ?? [];
    const leads = data?.leads ?? [];
    const payments = data?.payments ?? [];
    const pct = data?.commissionPct ?? 20;

    const byPack = new Map<string, { name: string; revenue: number; deals: number; open: number }>();
    let revenue = 0;
    for (const r of records) {
      const key = `${r.group_slug}::${r.pack_slug}`;
      const name = packs.find((p) => p.group === r.group_slug && p.slug === r.pack_slug)?.name ?? r.pack_slug;
      const row = byPack.get(key) ?? { name, revenue: 0, deals: 0, open: 0 };
      if (r.won === true) { row.revenue += Number(r.value ?? 0); row.deals += 1; revenue += Number(r.value ?? 0); }
      else if (r.won === null) row.open += 1;
      byPack.set(key, row);
    }

    const wonLeads = leads.filter((l) => l.status === "won");
    const leadRevenue = wonLeads.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
    const conversion = leads.length ? (wonLeads.length / leads.length) * 100 : 0;

    const collected = payments.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const outstanding = payments.filter((p) => p.status !== "paid").reduce((s, p) => s + Number(p.amount ?? 0), 0);

    const billableRevenue = revenue + leadRevenue;
    const payout = (billableRevenue * pct) / 100;

    return {
      packRows: [...byPack.values()].sort((a, b) => b.revenue - a.revenue),
      revenue, leadRevenue, billableRevenue, conversion,
      wonLeads: wonLeads.length, totalLeads: leads.length,
      collected, outstanding, pct, payout, payments,
    };
  }, [data, packs]);

  if (loading || isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!tenantId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> No workspace selected</CardTitle>
          <CardDescription>Pick a workspace from the switcher at the top to see its billing.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Revenue, conversions and partner payouts for {active?.name}. Only this workspace's records are counted.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5"><Handshake className="h-3.5 w-3.5" /> Partner share {view.pct}%</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Pack revenue" value={money(view.revenue)} hint="Closed-won pack records" icon={Wallet} />
        <Kpi title="Lead revenue" value={money(view.leadRevenue)} hint={`${view.wonLeads} of ${view.totalLeads} leads won`} icon={TrendingUp} />
        <Kpi title="Conversion" value={`${view.conversion.toFixed(1)}%`} hint="Leads won vs. total" icon={TrendingUp} />
        <Kpi title="Partner payout" value={money(view.payout)} hint={`${view.pct}% of ${money(view.billableRevenue)}`} icon={Handshake} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by pack</CardTitle>
            <CardDescription>Closed-won value for each industry pack you run.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {view.packRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No closed deals yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={view.packRows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => money(Number(v))} />
                  <Bar dataKey="revenue" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Payments</CardTitle>
            <CardDescription>Collected {money(view.collected)} · Outstanding {money(view.outstanding)}</CardDescription>
          </CardHeader>
          <CardContent>
            {view.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded for this workspace yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.payments.slice(0, 8).map((p, i) => (
                    <TableRow key={`${p.record_id}-${i}`}>
                      <TableCell className="text-sm">{p.label}</TableCell>
                      <TableCell><Badge variant={p.status === "paid" ? "secondary" : "outline"}>{p.status}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{money(Number(p.amount ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pack breakdown</CardTitle>
          <CardDescription>Deals closed, open work and the partner share owed on each pack.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pack</TableHead>
                <TableHead className="text-right">Won</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Payout ({view.pct}%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.packRows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Nothing to bill yet.</TableCell></TableRow>
              )}
              {view.packRows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right">{r.deals}</TableCell>
                  <TableCell className="text-right">{r.open}</TableCell>
                  <TableCell className="text-right">{money(r.revenue)}</TableCell>
                  <TableCell className="text-right">{money((r.revenue * view.pct) / 100)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
