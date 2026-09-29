import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, MousePointerClick, LogOut, Activity, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api"; // <-- adjust path if your api file lives elsewhere

export const Route = createFileRoute("/_authenticated/landing-analytics")({
  head: () => ({ meta: [{ title: "Landing Analytics — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="landing-analytics" label="Landing Analytics">
      <LandingAnalyticsPage />
    </RoleGuard>
  ),
});

/* ------------------------------------------------------------------ */
/* API types (match app/schemas/landing_analytics.py)                  */
/* ------------------------------------------------------------------ */

type Tenant = { id: number; name: string; subdomain?: string | null };

interface LandingAnalytics {
  kpi: {
    sessions: number;
    views: number;
    submits: number;
    conversion_rate: number;
    bounce_rate: number;
  };
  top_sources: { source: string; sessions: number; percentage: number }[];
  recent_events: {
    id?: number;
    event_type: string;
    source: string | null;
    session_id?: string | null;
    created_at: string;
  }[];
  range_days: number;
}

function LandingAnalyticsPage() {
  const { isAdmin, loading, roles } = useAuth();
  const isSuper = roles.includes("super_admin");

  const [tenantId, setTenantId] = useState<string>("all");
  const [days, setDays] = useState<string>("7");

  // Tenant list — only SuperAdmin can pick a tenant (backend scopes everyone else to their own)
  const { data: tenants = [] } = useQuery({
    queryKey: ["superadmin", "clients"],
    enabled: isAdmin && isSuper,
    queryFn: async () => {
      const res = await apiFetch<Tenant[] | { items: Tenant[] }>("/api/v1/superadmin/clients");
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["landing-analytics", isSuper ? tenantId : "own", days],
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const p = new URLSearchParams({ days });
      if (isSuper && tenantId !== "all") p.set("tenant_id", tenantId);
      return apiFetch<LandingAnalytics>(`/api/v1/landing/analytics?${p.toString()}`);
    },
  });

  const kpi = data?.kpi;
  const topSources = data?.top_sources ?? [];
  const recentEvents = data?.recent_events ?? [];

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-2">You don't have access to landing analytics.</p>
      </div>
    );
  }

  const bounceRate = kpi?.bounce_rate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="h-6 w-6" /> Landing Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Views, sources, bounce rate, and form conversions across tenant landing pages.</p>
        </div>
        <div className="flex gap-2">
          {isSuper && (
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="w-55"><SelectValue placeholder="Tenant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && !isLoading && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load analytics."}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Sessions" value={kpi?.sessions ?? 0} />
        <KpiCard icon={<MousePointerClick className="h-4 w-4" />} label="Views" value={kpi?.views ?? 0} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Submits" value={kpi?.submits ?? 0} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Conversion" value={`${(kpi?.conversion_rate ?? 0).toFixed(1)}%`} />
        <KpiCard
          icon={<LogOut className="h-4 w-4" />}
          label="Bounce rate"
          value={`${bounceRate.toFixed(1)}%`}
          tone={bounceRate > 60 ? "danger" : undefined}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top sources</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No traffic yet.</p>
            ) : (
              <ul className="space-y-2">
                {topSources.map((s) => (
                  <li key={s.source} className="flex items-center justify-between text-sm gap-3">
                    <span className="truncate">{s.source}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {s.sessions} · {s.percentage.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent events</CardTitle></CardHeader>
          <CardContent className="max-h-90 overflow-y-auto text-sm">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events in this range.</p>
            ) : (
              recentEvents.map((e, i) => (
                <div key={e.id ?? i} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="capitalize">{e.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.source ?? "direct"} · {new Date(e.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
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