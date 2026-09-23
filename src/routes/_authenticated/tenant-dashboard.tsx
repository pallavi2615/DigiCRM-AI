import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/lib/queries/tenants";
import { useAllPacks, useTenantPackKey } from "@/lib/pack-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Building2, Loader2, Settings, Sparkles, Target, TrendingUp, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tenant-dashboard")({
  head: () => ({
    meta: [
      { title: "Workspace Dashboard | DigiCRM AI" },
      { name: "description", content: "Your workspace's own pipeline, conversion, revenue and AI assistant usage — scoped to the industry pack you run." },
      { property: "og:title", content: "Workspace Dashboard | DigiCRM AI" },
      { property: "og:description", content: "Pipeline, conversion, revenue and assistant usage for your own workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TenantDashboard,
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

function TenantDashboard() {
  const { active, loading } = useActiveTenant();
  const { packs } = useAllPacks();
  const [key, setKey] = useState<string>("");

  const tenantId = active?.id ?? null;
  const tenantPackKey = useTenantPackKey(tenantId);
  const packKey = key || tenantPackKey || (packs[0] ? `${packs[0].group}::${packs[0].slug}` : "");
  const [group, slug] = packKey.split("::");
  const pack = packs.find((p) => p.group === group && p.slug === slug);


  const { data, isLoading } = useQuery({
    queryKey: ["tenant-dashboard", tenantId, group, slug],
    enabled: !!tenantId && !!group && !!slug,
    queryFn: async () => {
      const [recordsRes, leadsRes, usageRes, convRes] = await Promise.all([
        supabase
          .from("pack_records")
          .select("id, stage, value, won, created_at, closed_at")
          .eq("tenant_id", tenantId!)
          .eq("group_slug", group!)
          .eq("pack_slug", slug!)
          .is("deleted_at", null),
        supabase
          .from("leads")
          .select("id, status, estimated_value, created_at")
          .eq("tenant_id", tenantId!)
          .is("deleted_at", null),
        supabase
          .from("ai_usage_log")
          .select("id, created_at, prompt_chars, response_chars, group_slug, pack_slug")
          .eq("tenant_id", tenantId!)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("lead_conversions")
          .select("id, status, revenue, occurred_at, group_slug, pack_slug, lead_channels(name), lead_campaigns(name)")
          .eq("tenant_id", tenantId!)
          .order("occurred_at", { ascending: false })
          .limit(500),
      ]);
      return {
        records: recordsRes.data ?? [],
        leads: leadsRes.data ?? [],
        usage: (usageRes.data ?? []).filter((u) => u.group_slug === group && u.pack_slug === slug),
        conversions: (convRes.data ?? []).filter((c) => c.group_slug === group && c.pack_slug === slug),
      };
    },
  });

  const view = useMemo(() => {
    const records = data?.records ?? [];
    const leads = data?.leads ?? [];
    const usage = data?.usage ?? [];
    const stages = pack?.stages ?? [];
    const wonStages = new Set(pack?.wonStages ?? []);
    const lostStages = new Set(pack?.lostStages ?? []);

    const funnel = stages.map((s) => ({
      stage: s,
      count: records.filter((r) => r.stage === s).length,
      value: records.filter((r) => r.stage === s).reduce((n, r) => n + Number(r.value ?? 0), 0),
    }));

    const won = records.filter((r) => r.won === true || wonStages.has(r.stage));
    const knownStage = new Set(stages);
    // `won === false` is the default on every new record, so it only means
    // "lost" when the stage itself is a losing stage or is off the board.
    const lost = records.filter((r) => lostStages.has(r.stage) || (r.won === false && !knownStage.has(r.stage)));
    const open = records.filter((r) => !won.includes(r) && !lost.includes(r));

    const revenue = won.reduce((n, r) => n + Number(r.value ?? 0), 0);
    const pipelineValue = open.reduce((n, r) => n + Number(r.value ?? 0), 0);
    const closed = won.length + lost.length;

    const leadsWon = leads.filter((l) => l.status === "won").length;
    const leadConversion = leads.length ? (leadsWon / leads.length) * 100 : 0;

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      d.setDate(1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), revenue: 0, prompts: 0 };
    });
    for (const r of won) {
      const d = new Date(r.closed_at ?? r.created_at);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.revenue += Number(r.value ?? 0);
    }
    for (const u of usage) {
      const d = new Date(u.created_at);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) m.prompts += 1;
    }

    const since30 = Date.now() - 30 * 24 * 3600 * 1000;
    const usage30 = usage.filter((u) => new Date(u.created_at).getTime() >= since30);

    return {
      funnel, revenue, pipelineValue, openCount: open.length, wonCount: won.length,
      winRate: closed ? (won.length / closed) * 100 : 0,
      leadConversion, leadCount: leads.length,
      months, promptCount: usage.length, prompts30: usage30.length,
      chars30: usage30.reduce((n, u) => n + (u.prompt_chars ?? 0) + (u.response_chars ?? 0), 0),
    };
  }, [data, pack]);

  const sourceRows = useMemo(() => {
    const rows = (data?.conversions ?? []) as Array<{
      status: string | null; revenue: number | null;
      lead_channels: { name: string } | null; lead_campaigns: { name: string } | null;
    }>;
    const map = new Map<string, { name: string; campaign: string; total: number; won: number; revenue: number; rate: number }>();
    for (const r of rows) {
      const name = r.lead_channels?.name ?? "Direct";
      const campaign = r.lead_campaigns?.name ?? "No campaign";
      const k = `${name}|${campaign}`;
      const cur = map.get(k) ?? { name, campaign, total: 0, won: 0, revenue: 0, rate: 0 };
      cur.total += 1;
      if (r.status === "won") cur.won += 1;
      cur.revenue += Number(r.revenue ?? 0);
      map.set(k, cur);
    }
    return [...map.values()]
      .map((s) => ({ ...s, rate: s.total ? (s.won / s.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  if (loading) return <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  if (!active) {
    return (
      <Card className="m-4"><CardContent className="p-10 text-center space-y-3">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You do not have a workspace yet.</p>
        <Button asChild><Link to="/onboarding">Set up a workspace</Link></Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{active.name} — workspace dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Everything below is your workspace only, in the wording of your own pack.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={packKey} onValueChange={setKey}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Choose a pack" /></SelectTrigger>
            <SelectContent className="max-h-80">
              {packs.map((p) => (
                <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>
                  {p.groupName} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline"><Link to="/settings-pack"><Settings className="mr-2 h-4 w-4" />Pack settings</Link></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Kpi title={`Open ${pack?.recordLabelPlural ?? "deals"}`} value={String(view.openCount)} hint={money(view.pipelineValue) + " in play"} icon={TrendingUp} />
            <Kpi title="Won" value={String(view.wonCount)} hint={`${view.winRate.toFixed(1)}% win rate`} icon={Target} />
            <Kpi title={pack?.valueLabel ?? "Revenue"} value={money(view.revenue)} hint="closed and won" icon={Wallet} />
            <Kpi title="Lead conversion" value={`${view.leadConversion.toFixed(1)}%`} hint={`${view.leadCount} leads in this workspace`} icon={Target} />
            <Kpi title="AI prompts" value={String(view.prompts30)} hint={`${view.promptCount} all time · ${Math.round(view.chars30 / 1000)}k characters (30d)`} icon={Sparkles} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pipeline by stage</CardTitle>
                <CardDescription>Your own stage names from Pack Settings.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={view.funnel}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="stage" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                      <Bar dataKey="count" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Stage values</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {view.funnel.map((f) => (
                  <div key={f.stage} className="flex items-center justify-between text-sm">
                    <span className="truncate">{f.stage}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{f.count}</Badge>
                      <span className="text-muted-foreground">{money(f.value)}</span>
                    </span>
                  </div>
                ))}
                {view.funnel.length === 0 && <p className="text-sm text-muted-foreground">This pack has no stages yet.</p>}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Revenue and assistant usage, last 6 months</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer>
                    <LineChart data={view.months}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={12} />
                      <YAxis yAxisId="l" fontSize={12} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                      <YAxis yAxisId="r" orientation="right" fontSize={12} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} />
                      <Line yAxisId="l" type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" strokeWidth={2} />
                      <Line yAxisId="r" type="monotone" dataKey="prompts" stroke="var(--color-chart-3)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Where these leads came from</CardTitle>
                <CardDescription>Google Sheets imports, Facebook and Instagram forms and your own campaigns, counted for this pack only.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sourceRows.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tracked sources yet. Connect a sheet or a Facebook form on the Inbound Leads page and they will show up here.
                  </p>
                )}
                {sourceRows.map((s) => (
                  <div key={s.name} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.campaign}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">{s.total} leads</Badge>
                      <span className="text-xs text-muted-foreground">{s.won} won · {s.rate.toFixed(0)}%</span>
                      <span className="font-medium">{money(s.revenue)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
