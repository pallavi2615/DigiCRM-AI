import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Ticket, IndianRupee, CheckCircle2, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/it/")({
  component: ITDashboard,
});

// GET /api/v1/it/dashboard
interface ITDashboardResponse {
  active_projects: number;
  delivered_projects: number;
  open_tickets: number;
  revenue_booked: number;
  projects_by_stage: { stage: string; count: number }[];
  tickets_by_priority: { priority: string; count: number }[];
}

const PRIORITIES = ["low", "medium", "high", "urgent"];
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#14b8a6", "#f97316", "#22c55e"];

const inr = (n: number) => (n ? "₹" + (n / 100000).toFixed(1) + "L" : "₹0");

function ITDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["it", "dashboard"],
    queryFn: () => apiFetch<ITDashboardResponse>("/api/v1/it/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-sm text-destructive">
        {(error as Error)?.message ?? "Could not load the IT dashboard."}
      </div>
    );
  }

  const stageData = data.projects_by_stage.map((s) => ({
    stage: s.stage.replace(/_/g, " "),
    count: s.count,
  }));

  // keep the fixed low → urgent order and colours; missing priorities count as 0
  const prioData = PRIORITIES.map((k) => ({
    name: k,
    value: data.tickets_by_priority.find((p) => p.priority === k)?.count ?? 0,
  }));

  const kpis = [
    { label: "Active Projects", value: data.active_projects, icon: Briefcase },
    { label: "Delivered", value: data.delivered_projects, icon: CheckCircle2 },
    { label: "Open Tickets", value: data.open_tickets, icon: Ticket },
    { label: "Revenue Booked", value: inr(data.revenue_booked), icon: IndianRupee },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</div>
                  <div className="text-2xl font-bold mt-1">{k.value}</div>
                </div>
                <k.icon className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Projects by Stage</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stageData}>
                <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Tickets by Priority</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={prioData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {prioData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}