import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, MousePointerClick, LogOut, Activity, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/landing-analytics")({
  head: () => ({ meta: [{ title: "Landing Analytics — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="landing-analytics" label="Landing Analytics">
      <LandingAnalyticsPage />
    </RoleGuard>
  ),
});

type Tenant = { id: string; name: string; slug: string };
type Ev = {
  tenant_id: string; event_type: string; source: string | null;
  utm_source: string | null; referrer: string | null; session_id: string | null;
  created_at: string;
};

function LandingAnalyticsPage() {
  const { isAdmin, loading } = useAuth();
  const [tenantId, setTenantId] = useState<string>("all");
  const [days, setDays] = useState<string>("7");

  const { data: tenants = [] } = useQuery({
    queryKey: ["la-tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name, slug").order("name");
      return (data ?? []) as Tenant[];
    },
    enabled: isAdmin,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["la-events", tenantId, days],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      let q = supabase
        .from("landing_page_events")
        .select("tenant_id, event_type, source, utm_source, referrer, session_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (tenantId !== "all") q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Ev[];
    },
    enabled: isAdmin,
  });

  const stats = useMemo(() => {
    const sessions = new Set<string>();
    const bouncedSessions = new Set<string>();
    const engagedSessions = new Set<string>();
    const submittedSessions = new Set<string>();
    let views = 0, submits = 0, bounces = 0;
    const bySource = new Map<string, number>();

    for (const e of events) {
      if (e.session_id) sessions.add(e.session_id);
      if (e.event_type === "view") { views++; bySource.set(e.source ?? "direct", (bySource.get(e.source ?? "direct") ?? 0) + 1); }
      if (e.event_type === "submit") { submits++; if (e.session_id) submittedSessions.add(e.session_id); }
      if (e.event_type === "bounce" && e.session_id) bouncedSessions.add(e.session_id);
      if (e.event_type === "engaged" && e.session_id) engagedSessions.add(e.session_id);
    }
    for (const s of submittedSessions) bouncedSessions.delete(s);
    for (const s of engagedSessions) bouncedSessions.delete(s);
    bounces = bouncedSessions.size;
    const totalSessions = sessions.size || 1;
    return {
      views, submits, bounces,
      totalSessions: sessions.size,
      conversion: views > 0 ? (submits / views) * 100 : 0,
      bounceRate: (bounces / totalSessions) * 100,
      bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [events]);

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-2">You don't have access to landing analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="h-6 w-6" /> Landing Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Views, sources, bounce rate, and form conversions across tenant landing pages.</p>
        </div>
        <div className="flex gap-2">
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tenant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Sessions" value={stats.totalSessions} />
        <KpiCard icon={<MousePointerClick className="h-4 w-4" />} label="Views" value={stats.views} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Submits" value={stats.submits} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Conversion" value={`${stats.conversion.toFixed(1)}%`} />
        <KpiCard icon={<LogOut className="h-4 w-4" />} label="Bounce rate" value={`${stats.bounceRate.toFixed(1)}%`} tone={stats.bounceRate > 60 ? "danger" : undefined} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top sources</CardTitle></CardHeader>
          <CardContent>
            {stats.bySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">No traffic yet.</p>
            ) : (
              <ul className="space-y-2">
                {stats.bySource.map(([src, count]) => (
                  <li key={src} className="flex items-center justify-between text-sm">
                    <span className="truncate">{src}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent events</CardTitle></CardHeader>
          <CardContent className="max-h-[360px] overflow-y-auto text-sm">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
              events.slice(0, 30).map((e, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="capitalize">{e.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.source ?? "direct"} · {new Date(e.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            }
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Tip: view a tenant landing at <Link to="/" className="underline">/t/&lt;slug&gt;</Link> and events will start streaming here.
      </p>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: "danger" }) {
  return (
    <Card className={tone === "danger" ? "border-destructive/40" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className={`text-2xl font-semibold mt-2 ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
