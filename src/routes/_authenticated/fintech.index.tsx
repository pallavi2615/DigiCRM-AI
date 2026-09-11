import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, TrendingUp, IndianRupee, Wallet, FileStack, CheckCircle2, Timer, CalendarDays, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useRealtimeTable } from "@/lib/use-realtime-table";

export const Route = createFileRoute("/_authenticated/fintech/")({
  component: FintechDashboard,
});

/** Ordered DSA funnel — rejected / on_hold sit outside the progression. */
const FUNNEL: { key: string; label: string }[] = [
  { key: "new", label: "New" },
  { key: "docs_pending", label: "Docs Pending" },
  { key: "docs_collected", label: "Docs Collected" },
  { key: "login", label: "Login" },
  { key: "under_review", label: "Under Review" },
  { key: "sanctioned", label: "Sanctioned" },
  { key: "disbursed", label: "Disbursed" },
];
const ORDER = FUNNEL.map((f) => f.key);

interface App {
  id: string; stage: string; requested_amount: number | null; disbursed_amount: number | null;
  sanctioned_amount: number | null; loan_type: string; disbursed_at: string | null;
  lender_id: string | null; created_at: string;
}

function FintechDashboard() {
  const { data: apps = [] } = useQuery({
    queryKey: ["fintech-apps"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("loan_applications")
        .select("id, stage, requested_amount, disbursed_amount, sanctioned_amount, loan_type, disbursed_at, lender_id, created_at")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as App[];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["fintech-commissions-summary"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("loan_commissions").select("expected_amount, received_amount, status, lender_id");
      return (data ?? []) as any[];
    },
  });

  const { data: lenders = [] } = useQuery({
    queryKey: ["fintech-lenders-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lenders").select("id, name");
      return (data ?? []) as any[];
    },
  });

  useRealtimeTable("loan_applications", [["fintech-apps"], ["fintech-pipeline"], ["loan-apps"]]);
  useRealtimeTable("loan_commissions", [["fintech-commissions-summary"], ["commissions"]]);

  const lenderMap: Record<string, string> = Object.fromEntries(lenders.map((l: any) => [l.id, l.name]));
  const now = new Date();
  const sameMonth = (d?: string | null) =>
    !!d && new Date(d).getMonth() === now.getMonth() && new Date(d).getFullYear() === now.getFullYear();

  const mtd = apps.filter((a) => sameMonth(a.disbursed_at));
  const disbursedMTD = mtd.reduce((s, a) => s + Number(a.disbursed_amount || 0), 0);
  const active = apps.filter((a) => !["disbursed", "rejected"].includes(a.stage));
  const pipelineValue = active.reduce((s, a) => s + Number(a.requested_amount || 0), 0);
  const expectedCommission = commissions.reduce((s, c) => s + Number(c.expected_amount || 0), 0);
  const receivedCommission = commissions.reduce((s, c) => s + Number(c.received_amount || 0), 0);

  // Conversion metrics
  const disbursedApps = apps.filter((a) => a.stage === "disbursed");
  const sanctionedApps = apps.filter((a) => a.stage === "sanctioned");
  const rejectedApps = apps.filter((a) => a.stage === "rejected");
  const decided = sanctionedApps.length + disbursedApps.length + rejectedApps.length;
  const sanctionRate = decided ? Math.round(((sanctionedApps.length + disbursedApps.length) / decided) * 100) : 0;
  const sanctionedOrBeyond = sanctionedApps.length + disbursedApps.length;
  const disbursalRate = sanctionedOrBeyond ? Math.round((disbursedApps.length / sanctionedOrBeyond) * 100) : 0;

  const tatSamples = disbursedApps
    .filter((a) => a.disbursed_at && a.created_at)
    .map((a) => (new Date(a.disbursed_at!).getTime() - new Date(a.created_at).getTime()) / 86400000)
    .filter((d) => d >= 0);
  const avgTat = tatSamples.length ? (tatSamples.reduce((s, d) => s + d, 0) / tatSamples.length).toFixed(1) : "—";

  const newThisMonth = apps.filter((a) => sameMonth(a.created_at)).length;

  // Funnel: how many files reached at least this stage
  const rank = (stage: string) => ORDER.indexOf(stage);
  const funnel = FUNNEL.map((f, i) => {
    const reached = apps.filter((a) => rank(a.stage) >= i).length;
    return { ...f, reached };
  });
  const funnelTop = funnel[0]?.reached ?? 0;

  // Lender-wise performance
  const lenderRows = Object.values(
    apps.reduce((acc: Record<string, any>, a) => {
      const key = a.lender_id ?? "none";
      acc[key] = acc[key] ?? { id: key, name: lenderMap[key] ?? "Unassigned", files: 0, sanctioned: 0, disbursed: 0, payout: 0 };
      acc[key].files += 1;
      acc[key].sanctioned += Number(a.sanctioned_amount || 0);
      acc[key].disbursed += Number(a.disbursed_amount || 0);
      return acc;
    }, {}),
  ).map((row: any) => ({
    ...row,
    payout: commissions.filter((c) => (c.lender_id ?? "none") === row.id).reduce((s, c) => s + Number(c.expected_amount || 0), 0),
  })).sort((a: any, b: any) => b.disbursed - a.disbursed);

  const lenderPie = lenderRows.filter((r: any) => r.disbursed > 0).slice(0, 5).map((r: any) => ({ name: r.name, value: r.disbursed }));

  const inr = (n: number) => "₹" + (n / 100000).toFixed(1) + "L";

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={IndianRupee} label="Disbursed (MTD)" value={inr(disbursedMTD)} badge={`${mtd.length} files`} />
        <Kpi icon={FileStack} label="Active Pipeline" value={inr(pipelineValue)} badge={`${active.length} apps`} />
        <Kpi icon={TrendingUp} label="Expected Payout" value={inr(expectedCommission)} />
        <Kpi icon={Wallet} label="Received Payout" value={inr(receivedCommission)} tone="text-success" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={CheckCircle2} label="Sanction Rate" value={`${sanctionRate}%`} badge={`${decided} decided`} />
        <Kpi icon={Percent} label="Disbursal Rate" value={`${disbursalRate}%`} badge={`${disbursedApps.length} disbursed`} />
        <Kpi icon={Timer} label="Avg Turnaround" value={avgTat === "—" ? "—" : `${avgTat} d`} badge="login → disbursal" />
        <Kpi icon={CalendarDays} label="New This Month" value={String(newThisMonth)} badge={`${apps.length} total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Application Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {funnelTop === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No applications yet</p>
            ) : funnel.map((f, i) => {
              const pctOfTop = funnelTop ? Math.round((f.reached / funnelTop) * 100) : 0;
              const prev = funnel[i - 1]?.reached ?? f.reached;
              const dropOff = i === 0 || prev === 0 ? 0 : Math.round(((prev - f.reached) / prev) * 100);
              return (
                <div key={f.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground">
                      {f.reached} · {pctOfTop}%
                      {i > 0 && dropOff > 0 && <span className="text-destructive ml-2">−{dropOff}%</span>}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctOfTop}%` }} />
                  </div>
                </div>
              );
            })}
            {rejectedApps.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                {rejectedApps.length} rejected · {apps.filter((a) => a.stage === "on_hold").length} on hold
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" />Top Lenders (Disbursed)</CardTitle></CardHeader>
          <CardContent>
            {lenderPie.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No disbursals yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={lenderPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => e.name}>
                    {lenderPie.map((_, i) => <Cell key={i} fill={`hsl(${(i * 60) % 360} 70% 55%)`} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => inr(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Lender-wise Performance</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Lender</TableHead><TableHead>Files</TableHead><TableHead>Sanctioned</TableHead>
              <TableHead>Disbursed</TableHead><TableHead>Expected Payout</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lenderRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No applications yet</TableCell></TableRow>
              ) : lenderRows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.files}</TableCell>
                  <TableCell>{inr(r.sanctioned)}</TableCell>
                  <TableCell className="text-success">{inr(r.disbursed)}</TableCell>
                  <TableCell>{inr(r.payout)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, badge, tone }: { icon: any; label: string; value: string; badge?: string; tone?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <Icon className="h-3 w-3" />{label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
        {badge && <Badge variant="secondary" className="mt-1 text-[10px]">{badge}</Badge>}
      </CardContent>
    </Card>
  );
}
