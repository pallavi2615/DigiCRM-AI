import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Ticket, IndianRupee, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/it/")({
  component: ITDashboard,
});

const STAGES = ["discovery", "proposal", "negotiation", "contract", "kickoff", "in_progress", "uat", "delivered", "closed"];
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#14b8a6", "#f97316", "#22c55e"];

function ITDashboard() {
  const { data: projects = [] } = useQuery({ queryKey: ["it-proj-kpi"], queryFn: async () => (await (supabase as any).from("it_projects").select("id, stage, value")).data ?? [] });
  const { data: tickets = [] } = useQuery({ queryKey: ["it-tick-kpi"], queryFn: async () => (await (supabase as any).from("it_tickets").select("id, status, priority")).data ?? [] });

  const won = projects.filter((p: any) => ["delivered", "closed"].includes(p.stage));
  const revenue = won.reduce((s: number, p: any) => s + Number(p.value || 0), 0);
  const open = tickets.filter((t: any) => t.status !== "resolved" && t.status !== "closed").length;
  const stageData = STAGES.map((k) => ({ stage: k.replace(/_/g, " "), count: projects.filter((p: any) => p.stage === k).length }));
  const prioData = ["low", "medium", "high", "urgent"].map((k) => ({ name: k, value: tickets.filter((t: any) => t.priority === k).length }));

  const inr = (n: number) => n ? "₹" + (n / 100000).toFixed(1) + "L" : "₹0";

  const kpis = [
    { label: "Active Projects", value: projects.filter((p: any) => !["delivered","closed"].includes(p.stage)).length, icon: Briefcase },
    { label: "Delivered", value: won.length, icon: CheckCircle2 },
    { label: "Open Tickets", value: open, icon: Ticket },
    { label: "Revenue Booked", value: inr(revenue), icon: IndianRupee },
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
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
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
