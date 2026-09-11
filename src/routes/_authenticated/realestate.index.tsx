import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, Trophy, IndianRupee, MapPin, Percent, Ticket, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { useRealtimeTable } from "@/lib/use-realtime-table";

export const Route = createFileRoute("/_authenticated/realestate/")({
  component: RealEstateDashboard,
});

const VISIT_STAGES = ["site_visit_scheduled", "site_visit_done", "negotiation", "offer_made", "agreement", "token_paid", "closed_won"];

function RealEstateDashboard() {
  const { data: props = [] } = useQuery({
    queryKey: ["re-props-kpi"],
    queryFn: async () => (await (supabase as any).from("re_properties").select("id, status, price, property_type, city")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["re-clients-kpi"],
    queryFn: async () => (await (supabase as any).from("re_clients").select("id, full_name, kyc_status, budget_min, budget_max, preferred_city, preferred_type")).data ?? [],
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["re-deals-kpi"],
    queryFn: async () => (await (supabase as any).from("re_deals").select("id, stage, expected_value, final_value, agent_id")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["re-agent-profiles"],
    queryFn: async () => (await (supabase as any).from("profiles").select("id, full_name, email")).data ?? [],
  });

  useRealtimeTable("re_properties", [["re-props-kpi"], ["re-props"]]);
  useRealtimeTable("re_clients", [["re-clients-kpi"], ["re-clients"]]);
  useRealtimeTable("re_deals", [["re-deals-kpi"], ["re-pipeline"]]);

  const won = deals.filter((d: any) => d.stage === "closed_won");
  const gmv = won.reduce((s: number, d: any) => s + Number(d.final_value || d.expected_value || 0), 0);
  const visits = deals.filter((d: any) => VISIT_STAGES.includes(d.stage));
  const visitConversion = visits.length ? Math.round((won.length / visits.length) * 100) : 0;
  const avgTicket = won.length ? gmv / won.length : 0;
  const verified = clients.filter((c: any) => c.kyc_status === "verified").length;

  const statusData = Object.entries(props.reduce((acc: any, p: any) => {
    const k = p.status || "unknown";
    acc[k] = (acc[k] || 0) + 1; return acc;
  }, {})).map(([name, count]) => ({ name, count: count as number }));

  const typeData = Object.entries(props.reduce((acc: any, p: any) => {
    const k = p.property_type || "other";
    acc[k] = (acc[k] || 0) + 1; return acc;
  }, {})).map(([name, value]) => ({ name, value: value as number }));

  const stageData = Object.entries(deals.reduce((acc: any, d: any) => {
    acc[d.stage] = (acc[d.stage] || 0) + 1; return acc;
  }, {})).map(([name, count]) => ({ name: String(name).replace(/_/g, " "), count: count as number }));

  const profileMap: Record<string, string> = Object.fromEntries(
    profiles.map((p: any) => [p.id, p.full_name || p.email]),
  );
  const agentRows = Object.values(deals.reduce((acc: any, d: any) => {
    const key = d.agent_id ?? "unassigned";
    acc[key] = acc[key] ?? { id: key, name: profileMap[key] ?? (key === "unassigned" ? "Unassigned" : "Agent"), deals: 0, won: 0, value: 0 };
    acc[key].deals += 1;
    if (d.stage === "closed_won") { acc[key].won += 1; acc[key].value += Number(d.final_value || d.expected_value || 0); }
    return acc;
  }, {})).sort((a: any, b: any) => b.value - a.value);

  // Budget matching — inventory that fits each buyer's brief
  const available = props.filter((p: any) => p.status === "available");
  const matches: { id: string; name: string; city: string | null; count: number }[] = clients.map((c: any) => {
    const list = available.filter((p: any) => {
      const price = Number(p.price || 0);
      if (c.budget_min && price < Number(c.budget_min)) return false;
      if (c.budget_max && price > Number(c.budget_max)) return false;
      if (c.preferred_city && p.city && String(p.city).toLowerCase() !== String(c.preferred_city).toLowerCase()) return false;
      if (c.preferred_type && p.property_type && String(p.property_type).toLowerCase() !== String(c.preferred_type).toLowerCase()) return false;
      return true;
    });
    return { id: c.id, name: c.full_name, city: c.preferred_city, count: list.length };
  }).sort((a: any, b: any) => b.count - a.count).slice(0, 8);

  const inr = (n: number) => "₹" + (n / 100000).toFixed(1) + "L";

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Building2} label="Active Listings" value={String(available.length)} badge={`${props.length} total`} />
        <Kpi icon={Users} label="Total Clients" value={String(clients.length)} badge={`${verified} KYC verified`} />
        <Kpi icon={Trophy} label="Deals Won" value={String(won.length)} badge={`${deals.length} deals`} />
        <Kpi icon={IndianRupee} label="GMV Closed" value={inr(gmv)} tone="text-success" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={MapPin} label="Site Visits" value={String(visits.length)} badge="scheduled or beyond" />
        <Kpi icon={Percent} label="Visit → Close" value={`${visitConversion}%`} />
        <Kpi icon={Ticket} label="Avg Ticket Size" value={inr(avgTicket)} />
        <Kpi icon={ShieldCheck} label="KYC Verified" value={clients.length ? `${Math.round((verified / clients.length) * 100)}%` : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Listings by Status</CardTitle></CardHeader>
          <CardContent>
            {statusData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Inventory Mix by Type</CardTitle></CardHeader>
          <CardContent>
            {typeData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>
                    {typeData.map((_, i) => <Cell key={i} fill={`hsl(${(i * 55 + 200) % 360} 68% 55%)`} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Deals by Stage</CardTitle></CardHeader>
        <CardContent>
          {stageData.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Agent-wise Closures</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Deals</TableHead><TableHead>Won</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {agentRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No deals yet</TableCell></TableRow>
                ) : agentRows.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.deals}</TableCell>
                    <TableCell>{a.won}</TableCell>
                    <TableCell className="text-success">{inr(a.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Matching Inventory by Buyer</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Buyer</TableHead><TableHead>Preferred City</TableHead><TableHead className="text-right">Matches</TableHead></TableRow></TableHeader>
              <TableBody>
                {matches.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No clients yet</TableCell></TableRow>
                ) : matches.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.city || "Any"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={m.count > 0 ? "secondary" : "outline"}>{m.count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>;
}

function Kpi({ icon: Icon, label, value, badge, tone }: { icon: any; label: string; value: string; badge?: string; tone?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2"><Icon className="h-3 w-3" />{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
        {badge && <Badge variant="secondary" className="mt-1 text-[10px]">{badge}</Badge>}
      </CardContent>
    </Card>
  );
}
