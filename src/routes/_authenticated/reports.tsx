import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useActiveIndustry } from "@/lib/active-industry";
import { apiFetch } from "@/lib/api"; // <-- adjust path if your api file lives elsewhere
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — DigiCRM AI" }] }),
  component: ReportsPage,
});

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/* ------------------------------------------------------------------ */
/* API response types (match app/schemas/report.py)                    */
/* ------------------------------------------------------------------ */

interface ReportSummary {
  total_leads: number;
  won_deals: number;
  total_revenue: number;
  avg_deal_size: number;
  conversion_rate: number;
}

interface RevenueTrendReport {
  data: { label: string; year: number; month: number; leads: number; revenue: number }[];
  months: number;
  total_leads: number;
  total_revenue: number;
}

interface LeadSourcesReport {
  data: { source: string; count: number; percentage: number }[];
  total: number;
}

interface PriorityDistributionReport {
  data: { priority: string; count: number }[];
  total: number;
}

interface TopIndustriesReport {
  data: { industry: string; count: number }[];
  total: number;
}

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
  },
  labelStyle: { color: "var(--popover-foreground)" },
  itemStyle: { color: "var(--popover-foreground)" },
};

/** Build "?industry_group=..." when an industry is selected. */
function withIndustry(path: string, group: string | null, extra: Record<string, string | number> = {}) {
  const p = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)));
  if (group) p.set("industry_group", group);
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

function ReportsPage() {
  // NOTE: the hook returns `activeGroup` (not `group`)
  const { activeGroup: crmGroup, activeName } = useActiveIndustry();

  const common = { placeholderData: keepPreviousData } as const;

  const { data: summary } = useQuery({
    queryKey: ["reports", "summary", crmGroup],
    queryFn: () => apiFetch<ReportSummary>(withIndustry("/api/v1/reports/summary", crmGroup)),
    ...common,
  });

  const { data: trend } = useQuery({
    queryKey: ["reports", "revenue-trend", crmGroup],
    queryFn: () =>
      apiFetch<RevenueTrendReport>(withIndustry("/api/v1/reports/revenue-trend", crmGroup, { months: 12 })),
    ...common,
  });

  const { data: sources } = useQuery({
    queryKey: ["reports", "lead-sources", crmGroup],
    queryFn: () => apiFetch<LeadSourcesReport>(withIndustry("/api/v1/reports/lead-sources", crmGroup)),
    ...common,
  });

  const { data: priority } = useQuery({
    queryKey: ["reports", "priority-distribution", crmGroup],
    queryFn: () =>
      apiFetch<PriorityDistributionReport>(withIndustry("/api/v1/reports/priority-distribution", crmGroup)),
    ...common,
  });

  const { data: industries } = useQuery({
    queryKey: ["reports", "top-industries", crmGroup],
    queryFn: () =>
      apiFetch<TopIndustriesReport>(withIndustry("/api/v1/reports/top-industries", crmGroup, { limit: 6 })),
    ...common,
  });

  // Map API shapes -> chart shapes
  const months = trend?.data ?? [];
  const bySource = (sources?.data ?? []).map((s) => ({ name: s.source, value: s.count }));
  const byPriority = (priority?.data ?? []).map((p) => ({ name: p.priority, value: p.count }));
  const byIndustry = (industries?.data ?? []).map((i) => ({ name: i.industry, value: i.count }));

  const kpis = [
    { label: "Total Leads", value: summary?.total_leads ?? 0 },
    { label: "Won Deals", value: summary?.won_deals ?? 0 },
    { label: "Revenue", value: `$${(summary?.total_revenue ?? 0).toLocaleString()}` },
    { label: "Avg Deal", value: `$${Math.round(summary?.avg_deal_size ?? 0).toLocaleString()}` },
    { label: "Conversion", value: `${(summary?.conversion_rate ?? 0).toFixed(1)}%` },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {crmGroup ? `${activeName} — insights across this industry only.` : "Insights across your sales performance."}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map((k) => (
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
          <CardHeader>
            <CardTitle className="text-base">Leads & Revenue Trend (12 mo)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <LineChart data={months}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis yAxisId="l" fontSize={12} />
                <YAxis
                  yAxisId="r"
                  orientation="right"
                  fontSize={12}
                  tickFormatter={(v) => `$${v / 1000}k`}
                />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
                <Line yAxisId="l" type="monotone" dataKey="leads" stroke={COLORS[0]} strokeWidth={2} />
                <Line yAxisId="r" type="monotone" dataKey="revenue" stroke={COLORS[1]} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Leads by Source</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={bySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byPriority} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={12} width={70} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" fill={COLORS[2]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Top Industries</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="20%" outerRadius="90%" data={byIndustry}>
                <RadialBar dataKey="value" cornerRadius={6}>
                  {byIndustry.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </RadialBar>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}