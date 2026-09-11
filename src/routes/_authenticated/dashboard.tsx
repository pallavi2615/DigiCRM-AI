import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, DollarSign, TrendingUp, Target, Trophy, XCircle,
  CheckSquare, Calendar as CalIcon, ArrowUpRight, ArrowDownRight,
  GripVertical, EyeOff, Eye, RotateCcw, Search, Settings2,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { NotificationsButton } from "@/components/notifications-button";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GlobalSearch } from "@/components/global-search";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DigiCRM AI" }] }),
  component: Dashboard,
});

type KpiData = {
  totalLeads: number;
  qualified: number;
  openDeals: number;
  won: number;
  lost: number;
  revenue: number;
  pipelineValue: number;
  avgDealSize: number;
  conversionRate: number;
  tasksToday: number;
  upcomingMeetings: number;
};

async function fetchKpis(g: string | null): Promise<KpiData> {
  const [leadsRes, tasksRes, meetingsRes] = await Promise.all([
    scopeToIndustry(supabase.from("leads").select("status, estimated_value").is("deleted_at", null), g),
    scopeToIndustry(supabase.from("tasks").select("id, due_date, status").in("status", ["todo", "in_progress"]), g),
    scopeToIndustry(supabase.from("meetings").select("id, starts_at").gte("starts_at", new Date().toISOString()).eq("status", "scheduled"), g),
  ]);
  const leads = leadsRes.data ?? [];
  const totalLeads = leads.length;
  const qualified = leads.filter(l => l.status === "qualified").length;
  const openDeals = leads.filter(l => !["won","lost"].includes(l.status)).length;
  const won = leads.filter(l => l.status === "won").length;
  const lost = leads.filter(l => l.status === "lost").length;
  const revenue = leads.filter(l => l.status === "won").reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const pipelineValue = leads.filter(l => !["won","lost"].includes(l.status)).reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const avgDealSize = won > 0 ? revenue / won : 0;
  const conversionRate = totalLeads > 0 ? (won / totalLeads) * 100 : 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const tasksToday = (tasksRes.data ?? []).filter(t => t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) < tomorrow).length;
  return { totalLeads, qualified, openDeals, won, lost, revenue, pipelineValue, avgDealSize, conversionRate, tasksToday, upcomingMeetings: meetingsRes.data?.length ?? 0 };
}

async function fetchFunnel(g: string | null) {
  const { data } = await scopeToIndustry(supabase.from("leads").select("status").is("deleted_at", null), g);
  const stages = ["new","contacted","qualified","proposal_sent","negotiation","won"];
  const counts = stages.map(s => ({ stage: s.replace("_"," "), value: (data ?? []).filter(l => l.status === s).length }));
  return counts;
}

async function fetchSources(g: string | null) {
  const { data } = await scopeToIndustry(supabase.from("leads").select("source").is("deleted_at", null), g);
  const map = new Map<string, number>();
  (data ?? []).forEach(l => {
    const s = l.source || "Unknown";
    map.set(s, (map.get(s) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

async function fetchMonthlyRevenue(g: string | null) {
  const { data } = await scopeToIndustry(supabase
    .from("leads")
    .select("estimated_value, updated_at")
    .eq("status", "won"), g);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); d.setDate(1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), revenue: 0, deals: 0 };
  });
  (data ?? []).forEach(l => {
    const d = new Date(l.updated_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = months.find(x => x.key === key);
    if (m) { m.revenue += Number(l.estimated_value ?? 0); m.deals += 1; }
  });
  return months;
}

async function fetchRecentActivities() {
  const { data } = await supabase
    .from("activities")
    .select("id, action, description, entity_type, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const CHART_RAW = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function KpiCard({ title, value, hint, icon: Icon, trend, accent }: {
  title: string; value: string; hint?: string; icon: React.ComponentType<{className?: string}>;
  trend?: { dir: "up"|"down"; value: string }; accent?: string;
}) {
  return (
    <Card className="shadow-card hover:shadow-elegant transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold mt-1.5" style={{fontFamily: "var(--font-display)"}}>{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend.dir === "up" ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
            <span className={trend.dir === "up" ? "text-success" : "text-destructive"}>{trend.value}</span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -------- Widget definitions --------
type KpiSpec = { id: string; title: string; get: (k: KpiData | undefined) => string; icon: any; accent?: string; to?: string; search?: Record<string, string> };
const KPI_WIDGETS: KpiSpec[] = [
  { id: "totalLeads", title: "Total Leads", get: (k) => String(k?.totalLeads ?? 0), icon: Users, accent: "bg-primary/10 text-primary", to: "/leads" },
  { id: "qualified", title: "Qualified", get: (k) => String(k?.qualified ?? 0), icon: Target, accent: "bg-info/10 text-info", to: "/leads", search: { status: "qualified" } },
  { id: "openDeals", title: "Open Deals", get: (k) => String(k?.openDeals ?? 0), icon: TrendingUp, accent: "bg-warning/10 text-warning", to: "/pipeline" },
  { id: "won", title: "Won", get: (k) => String(k?.won ?? 0), icon: Trophy, accent: "bg-success/10 text-success", to: "/leads", search: { status: "won" } },
  { id: "lost", title: "Lost", get: (k) => String(k?.lost ?? 0), icon: XCircle, accent: "bg-destructive/10 text-destructive", to: "/leads", search: { status: "lost" } },
  { id: "revenue", title: "Revenue", get: (k) => formatCurrency(k?.revenue ?? 0), icon: DollarSign, accent: "bg-success/10 text-success" },
  { id: "pipelineValue", title: "Pipeline Value", get: (k) => formatCurrency(k?.pipelineValue ?? 0), icon: TrendingUp, to: "/pipeline" },
  { id: "avgDealSize", title: "Avg Deal Size", get: (k) => formatCurrency(k?.avgDealSize ?? 0), icon: DollarSign },
  { id: "conversionRate", title: "Conversion", get: (k) => `${(k?.conversionRate ?? 0).toFixed(1)}%`, icon: Target },
  { id: "tasksToday", title: "Tasks Today", get: (k) => String(k?.tasksToday ?? 0), icon: CheckSquare, to: "/tasks" },
];

function SortableKpi({
  spec,
  kpi,
  hidden,
  onHide,
  editing,
  selectedCrm,
}: {
  spec: KpiSpec;
  kpi: KpiData | undefined;
  hidden: boolean;
  onHide: () => void;
  editing: boolean;
  selectedCrm: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: spec.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  if (hidden) return null;
  return (
    <div ref={setNodeRef} style={style} className={`relative ${editing ? "ring-2 ring-primary/30 rounded-xl" : ""}`}>
      {editing && (
        <div className="absolute top-1 right-1 z-10 flex gap-0.5">
          <button {...attributes} {...listeners} className="h-6 w-6 rounded bg-background border shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing" title="Drag to reorder">
            <GripVertical className="h-3 w-3" />
          </button>
          <button onClick={onHide} className="h-6 w-6 rounded bg-background border shadow-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground" title="Hide widget">
            <EyeOff className="h-3 w-3" />
          </button>
        </div>
      )}
      {spec.to && !editing ? (
        <Link
              to={spec.to}
              search={
                spec.id === "totalLeads"
                  ? ({
                      ...(spec.search ?? {}),
                      industry_group: selectedCrm === "all" ? undefined : selectedCrm,
                    } as never)
                  : (spec.search as never)
              }
              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
          <KpiCard title={spec.title} value={spec.get(kpi)} icon={spec.icon} accent={spec.accent} />
        </Link>
      ) : (
        <KpiCard title={spec.title} value={spec.get(kpi)} icon={spec.icon} accent={spec.accent} />
      )}
    </div>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(KPI_WIDGETS.map(w => w.id));
  const [hidden, setHidden] = useState<string[]>([]);

const [selectedCrm, setSelectedCrm] = useState<string>("all");

const { data: crmOptions = [] } = useQuery({
  queryKey: ["dashboard-crm-options"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("industry_group")
      .is("deleted_at", null)
      .not("industry_group", "is", null);

    if (error) throw error;

    return Array.from(
      new Set(
        (data ?? [])
          .map((row) => row.industry_group)
          .filter(Boolean)
      )
    ).sort();
  },
});

const dashboardCrm = selectedCrm === "all" ? null : selectedCrm;

const { data: kpi } = useQuery({
  queryKey: ["kpi", dashboardCrm],
  queryFn: () => fetchKpis(dashboardCrm),
});

const { data: funnel } = useQuery({
  queryKey: ["funnel", dashboardCrm],
  queryFn: () => fetchFunnel(dashboardCrm),
});

const { data: sources } = useQuery({
  queryKey: ["sources", dashboardCrm],
  queryFn: () => fetchSources(dashboardCrm),
});

const { data: monthly } = useQuery({
  queryKey: ["monthly", dashboardCrm],
  queryFn: () => fetchMonthlyRevenue(dashboardCrm),
});

const { data: activities } = useQuery({
  queryKey: ["activities"],
  queryFn: fetchRecentActivities,
});

  // Realtime auto-refresh from any authorized source table
  useRealtimeTable("leads", [["kpi"], ["funnel"], ["sources"], ["monthly"], ["pipeline-deals"]]);
  useRealtimeTable("tasks", [["kpi"]]);
  useRealtimeTable("meetings", [["kpi"]]);
  useRealtimeTable("it_tickets", [["kpi"]]);
  useRealtimeTable("activities", [["activities"]]);

  // Load saved layout
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any).from("dashboard_layouts").select("layout, hidden_widgets").eq("user_id", user.id).maybeSingle();
      if (data?.layout?.order) setOrder(data.layout.order.filter((id: string) => KPI_WIDGETS.some(w => w.id === id)).concat(KPI_WIDGETS.map(w => w.id).filter(id => !data.layout.order.includes(id))));
      if (Array.isArray(data?.hidden_widgets)) setHidden(data.hidden_widgets);
    })();
  }, []);

  const saveLayout = async (nextOrder: string[], nextHidden: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from("dashboard_layouts").upsert({
      user_id: user.id,
      layout: { order: nextOrder },
      hidden_widgets: nextHidden,
    });
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    saveLayout(next, hidden);
  };
  const hideWidget = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    saveLayout(order, next);
  };
  const showAll = () => { setHidden([]); saveLayout(order, []); };
  const resetLayout = () => {
    const def = KPI_WIDGETS.map(w => w.id);
    setOrder(def); setHidden([]);
    saveLayout(def, []);
  };

  const orderedSpecs = useMemo(() => order.map(id => KPI_WIDGETS.find(w => w.id === id)!).filter(Boolean), [order]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time overview of all CRM pipelines and performance.
          </p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
          </Badge>
          <Select
            value={selectedCrm}
            onValueChange={setSelectedCrm}
          >
            <SelectTrigger className="w-42.5">
              <SelectValue placeholder="Select CRM" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">
                All CRMs
              </SelectItem>

              {crmOptions.map((crm) => (
                <SelectItem key={crm} value={crm}>
                  {crm}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} className="gap-2">
            <Search className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline text-[10px] px-1 py-0.5 rounded border bg-muted">⌘K</kbd>
          </Button>
          <NotificationsButton />
          <Button variant={editing ? "default" : "outline"} size="sm" onClick={() => setEditing(!editing)} className="gap-2">
            <Settings2 className="h-3.5 w-3.5" /> {editing ? "Done" : "Customize"}
          </Button>
          {editing && hidden.length > 0 && (
            <Button variant="ghost" size="sm" onClick={showAll} className="gap-2"><Eye className="h-3.5 w-3.5" /> Show all ({hidden.length})</Button>
          )}
          {editing && (
            <Button variant="ghost" size="sm" onClick={resetLayout} className="gap-2"><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
          )}
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* KPI Row — draggable, hideable */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={horizontalListSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {orderedSpecs.map(spec => (
              <SortableKpi
                key={spec.id}
                spec={spec}
                kpi={kpi}
                hidden={hidden.includes(spec.id)}
                onHide={() => hideWidget(spec.id)}
                editing={editing}
                selectedCrm={selectedCrm}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader><CardTitle className="text-base">Monthly Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={monthly ?? []}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_RAW[0]} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={CHART_RAW[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke={CHART_RAW[0]} fill="url(#rev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Lead Sources</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sources ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {(sources ?? []).map((_, i) => <Cell key={i} fill={CHART_RAW[i % CHART_RAW.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-card">
          <CardHeader><CardTitle className="text-base">Sales Funnel</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={funnel ?? []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="stage" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }} labelStyle={{ color: "var(--popover-foreground)" }} itemStyle={{ color: "var(--popover-foreground)" }} />
                  <Bar dataKey="value" fill={CHART_RAW[0]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(activities ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
              )}
              {(activities ?? []).map(a => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{a.description || a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
