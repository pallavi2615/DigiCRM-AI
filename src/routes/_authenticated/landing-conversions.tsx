import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, ShieldAlert, TrendingUp, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { objectsToCsv } from "@/lib/csv";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

import { DatePicker, DateTimePicker } from "@/components/ui/datetime-picker";
const validateDate = (d: string) => {
  // 1. Khali check
  if (!d || d.trim() === "") {
    throw new Error("Date is required");
  }

  // 2. Valid date check
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }

  // 3. Year range check (1900-2100)
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new Error(`Year must be between 1900 and 2100 (got: ${year})`);
  }

  // 4. Sahi ISO string return karo
  return date.toISOString();
};


export const Route = createFileRoute("/_authenticated/landing-conversions")({
  head: () => ({ meta: [{ title: "Conversions by Source — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="landing-conversions" label="Landing Conversions">
      <ConversionsPage />
    </RoleGuard>
  ),
});

type Tenant = { id: string; name: string };
type Ev = {
  tenant_id: string; event_type: string; source: string | null;
  utm_source: string | null; session_id: string | null; created_at: string;
};

function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() - offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function ConversionsPage() {
  const { isAdmin, loading } = useAuth();
  const [tenantId, setTenantId] = useState("all");
  const [from, setFrom] = useState(todayISO(29));
  const [to, setTo] = useState(todayISO(0));

  const { data: tenants = [] } = useQuery({
    queryKey: ["conv-tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name").order("name");
      return (data ?? []) as Tenant[];
    },
    enabled: isAdmin,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["conv-events", tenantId, from, to],
    queryFn: async () => {
      let q = supabase
        .from("landing_page_events")
        .select("tenant_id, event_type, source, utm_source, session_id, created_at")
        .gte("created_at", `${from}T00:00:00Z`)
        .lte("created_at", `${to}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(20000);
      if (tenantId !== "all") q = q.eq("tenant_id", tenantId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Ev[];
    },
    enabled: isAdmin,
  });

  const QUALIFIED_STATUSES = ["qualified", "contacted", "proposal_sent", "negotiation", "won"] as const;

  const { data: qualifiedLeads = 0 } = useQuery({
    queryKey: ["conv-qleads", tenantId, from, to],
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${from}T00:00:00Z`)
        .lte("created_at", `${to}T23:59:59Z`)
        .in("status", QUALIFIED_STATUSES);
      if (tenantId !== "all") q = q.eq("tenant_id", tenantId);
      const { count } = await q;
      return count ?? 0;
    },
    enabled: isAdmin,
  });

  type Row = { source: string; sessions: number; views: number; submits: number; conv: number; bounces: number; bounce_rate: number };

  const rows: Row[] = useMemo(() => {
    const sessionSource = new Map<string, string>();
    for (const e of events) {
      if (!e.session_id) continue;
      const src = (e.utm_source || e.source || "direct").toLowerCase();
      if (!sessionSource.has(e.session_id)) sessionSource.set(e.session_id, src);
    }
    const bySrc = new Map<string, { sessions: Set<string>; views: number; submits: Set<string>; engaged: Set<string>; bouncedRaw: Set<string> }>();
    for (const e of events) {
      const sid = e.session_id ?? "_none";
      const src = sessionSource.get(sid) ?? ((e.utm_source || e.source || "direct").toLowerCase());
      if (!bySrc.has(src)) bySrc.set(src, { sessions: new Set(), views: 0, submits: new Set(), engaged: new Set(), bouncedRaw: new Set() });
      const b = bySrc.get(src)!;
      if (e.session_id) b.sessions.add(e.session_id);
      if (e.event_type === "view") b.views++;
      if (e.event_type === "submit" && e.session_id) b.submits.add(e.session_id);
      if (e.event_type === "engaged" && e.session_id) b.engaged.add(e.session_id);
      if (e.event_type === "bounce" && e.session_id) b.bouncedRaw.add(e.session_id);
    }
    return Array.from(bySrc.entries()).map(([source, b]) => {
      const bounces = [...b.bouncedRaw].filter((s) => !b.submits.has(s) && !b.engaged.has(s)).length;
      const sessions = b.sessions.size;
      return {
        source, sessions, views: b.views, submits: b.submits.size,
        conv: b.views > 0 ? (b.submits.size / b.views) * 100 : 0,
        bounces, bounce_rate: sessions > 0 ? (bounces / sessions) * 100 : 0,
      };
    }).sort((a, b) => b.sessions - a.sessions);
  }, [events]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    sessions: acc.sessions + r.sessions,
    views: acc.views + r.views,
    submits: acc.submits + r.submits,
    bounces: acc.bounces + r.bounces,
  }), { sessions: 0, views: 0, submits: 0, bounces: 0 }), [rows]);

  const funnel = useMemo(() => {
    const v = totals.views, s = totals.submits, q = qualifiedLeads;
    return [
      { stage: "Views", value: v, pct: 100, drop: 0 },
      { stage: "Submits", value: s, pct: v > 0 ? (s / v) * 100 : 0, drop: v > 0 ? ((v - s) / v) * 100 : 0 },
      { stage: "Qualified", value: q, pct: v > 0 ? (q / v) * 100 : 0, drop: s > 0 ? ((s - q) / s) * 100 : 0 },
    ];
  }, [totals, qualifiedLeads]);

  const downloadCsv = (name: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportCsv = () => {
    const headers = ["source", "sessions", "views", "submits", "conv_pct", "bounces", "bounce_rate_pct"];
    const objs = rows.map((r) => ({
      source: r.source, sessions: r.sessions, views: r.views, submits: r.submits,
      conv_pct: r.conv.toFixed(2), bounces: r.bounces, bounce_rate_pct: r.bounce_rate.toFixed(2),
    }));
    downloadCsv(`landing-conversions-${from}_to_${to}.csv`, objectsToCsv(objs, headers));
  };

  const exportFunnelCsv = () => {
    const headers = ["stage", "count", "pct_of_top", "drop_from_prev_pct"];
    const objs = funnel.map((f) => ({
      stage: f.stage, count: f.value, pct_of_top: f.pct.toFixed(2), drop_from_prev_pct: f.drop.toFixed(2),
    }));
    downloadCsv(`landing-funnel-${from}_to_${to}.csv`, objectsToCsv(objs, headers));
  };

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-2">You don't have access to conversion analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><TrendingUp className="h-6 w-6" /> Conversions by source</h1>
          <p className="text-sm text-muted-foreground mt-1">Form conversions and bounce rate broken down by source attribution across tenant landing pages.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportFunnelCsv} variant="outline" size="sm"><Filter className="h-4 w-4 mr-2" />Funnel CSV</Button>
          <Button onClick={exportCsv} variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Sources CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1"><Label className="text-xs">Tenant</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">From</Label>
          <DatePicker
              value={from}
              onChange={(val) => setFrom(val)}
              placeholder="Start Date"
            /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label>
          <DatePicker
              value={to}
              onChange={(val) => setTo(val)}
              placeholder="End Date"
            /></div>
          <div className="space-y-1"><Label className="text-xs">Quick range</Label>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => { setFrom(todayISO(6)); setTo(todayISO(0)); }}>7d</Button>
              <Button size="sm" variant="outline" onClick={() => { setFrom(todayISO(29)); setTo(todayISO(0)); }}>30d</Button>
              <Button size="sm" variant="outline" onClick={() => { setFrom(todayISO(89)); setTo(todayISO(0)); }}>90d</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Conversion funnel: view → submit → qualified lead</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="stage" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any, _n, p: any) => [`${v} (${p.payload.pct.toFixed(1)}%)`, p.payload.stage]} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {funnel.map((_, i) => <Cell key={i} fill={["hsl(var(--primary))", "hsl(var(--primary)/0.75)", "hsl(var(--primary)/0.5)"][i]} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {funnel.map((f, i) => (
                <div key={f.stage} className="flex items-center justify-between border-b pb-1 last:border-0">
                  <span className="text-muted-foreground">{f.stage}</span>
                  <span className="font-medium tabular-nums">
                    {f.value}
                    <span className="text-muted-foreground text-xs ml-2">{f.pct.toFixed(1)}%</span>
                    {i > 0 && f.drop > 0 && <span className="text-destructive text-xs ml-2">−{f.drop.toFixed(1)}%</span>}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-2">Qualified = leads in status: {QUALIFIED_STATUSES.join(", ")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {totals.sessions} sessions · {totals.views} views · {totals.submits} submits · {totals.bounces} bounces
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="p-6 text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Loading…</p> :
            rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No landing events in this range.</p> :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Submits</TableHead>
                  <TableHead className="text-right">Conv %</TableHead>
                  <TableHead className="text-right">Bounce %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.source}>
                    <TableCell className="capitalize">{r.source}</TableCell>
                    <TableCell className="text-right">{r.sessions}</TableCell>
                    <TableCell className="text-right">{r.views}</TableCell>
                    <TableCell className="text-right">{r.submits}</TableCell>
                    <TableCell className="text-right font-medium">{r.conv.toFixed(1)}%</TableCell>
                    <TableCell className={`text-right ${r.bounce_rate > 60 ? "text-destructive" : ""}`}>{r.bounce_rate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>
    </div>
  );
}
