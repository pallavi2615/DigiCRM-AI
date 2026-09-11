import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — DigiCRM AI" }] }),
  component: ReportsPage,
});

const COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ReportsPage() {
  const { group: crmGroup, activeName } = useActiveIndustry();
  const { data } = useQuery({
    queryKey: ["reports", crmGroup],
    queryFn: async () => {
      const { data: leads } = await scopeToIndustry(supabase.from("leads").select("status, priority, source, industry, estimated_value, created_at").is("deleted_at", null), crmGroup);
      const rows = leads ?? [];
      const total = rows.length;
      const won = rows.filter(l => l.status === "won").length;
      const revenue = rows.filter(l => l.status === "won").reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
      const avg = won ? revenue / won : 0;

      const byPriority = ["low","medium","high","urgent"].map(p => ({ name: p, value: rows.filter(l => l.priority === p).length }));
      const bySource = Object.entries(rows.reduce<Record<string, number>>((acc, l) => { const k = l.source || "Unknown"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).map(([name, value]) => ({ name, value }));
      const byIndustry = Object.entries(rows.reduce<Record<string, number>>((acc, l) => { const k = l.industry || "Unknown"; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).slice(0, 6).map(([name, value]) => ({ name, value }));

      const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (11 - i)); d.setDate(1);
        return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), leads: 0, revenue: 0 };
      });
      rows.forEach(l => {
        const d = new Date(l.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const m = months.find(x => x.key === key);
        if (m) { m.leads += 1; if (l.status === "won") m.revenue += Number(l.estimated_value ?? 0); }
      });

      return { total, won, revenue, avg, conversion: total ? (won / total) * 100 : 0, byPriority, bySource, byIndustry, months };
    },
  });

  const kpis = [
    { label: "Total Leads", value: data?.total ?? 0 },
    { label: "Won Deals", value: data?.won ?? 0 },
    { label: "Revenue", value: `$${(data?.revenue ?? 0).toLocaleString()}` },
    { label: "Avg Deal", value: `$${Math.round(data?.avg ?? 0).toLocaleString()}` },
    { label: "Conversion", value: `${(data?.conversion ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">{crmGroup ? `${activeName} — insights across this industry only.` : "Insights across your sales performance."}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="text-2xl font-bold mt-1">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Leads & Revenue Trend (12 mo)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={data?.months ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="l" fontSize={12} />
                <YAxis yAxisId="r" orientation="right" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
                <Line yAxisId="l" type="monotone" dataKey="leads" stroke={COLORS[0]} strokeWidth={2} />
                <Line yAxisId="r" type="monotone" dataKey="revenue" stroke={COLORS[1]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Leads by Source</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data?.bySource ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {(data?.bySource ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Priority Distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={data?.byPriority ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={12} width={70} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} />
                <Bar dataKey="value" fill={COLORS[2]} radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Top Industries</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="20%" outerRadius="90%" data={data?.byIndustry ?? []}>
                <RadialBar dataKey="value" cornerRadius={6}>
                  {(data?.byIndustry ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </RadialBar>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
