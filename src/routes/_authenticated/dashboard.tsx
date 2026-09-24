import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Users,
  DollarSign,
  TrendingUp,
  Target,
  Trophy,
  XCircle,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  GripVertical,
  EyeOff,
  Eye,
  RotateCcw,
  Search,
  Settings2,
} from "lucide-react";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { useEffect, useMemo, useState } from "react";

import { useRealtimeTable } from "@/lib/use-realtime-table";
import { NotificationsButton } from "@/components/notifications-button";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { GlobalSearch } from "@/components/global-search";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — DigiCRM AI" }],
  }),
  component: Dashboard,
});

/* =========================================================
   TYPES
========================================================= */

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

type RevenueItem = {
  label: string;
  revenue: number;
  deals?: number;
};

type SourceItem = {
  name: string;
  value: number;
};

type FunnelItem = {
  stage: string;
  value: number;
};

type ActivityItem = {
  id: string | number;
  action?: string;
  description?: string;
  entity_type?: string;
  created_at?: string;
  actor_id?: string | number;
};

type PipelineItem = {
  stage: string;
  count: number;
  value: number;
};

type PerformerItem = {
  name: string;
  revenue: number;
  deals?: number;
  source?: string;
  lead_count?: number;
};

/* =========================================================
   API RESPONSE TYPES
========================================================= */

type DashboardStatsResponse = {
  total_leads?: number;
  qualified?: number;
  open_deals?: number;
  won?: number;
  lost?: number;
  revenue?: number;
  pipeline_value?: number;
  avg_deal_size?: number;
  conversion_rate?: number;
  tasks_today?: number;
};

/* =========================================================
   API HELPERS
========================================================= */

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stringValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/**
 * Some backend endpoints may return:
 *
 * [
 *   {...},
 *   {...}
 * ]
 *
 * or
 *
 * {
 *   data: [...]
 * }
 *
 * or
 *
 * {
 *   results: [...]
 * }
 *
 * This helper keeps the frontend tolerant of those formats.
 */
function extractArray<T = any>(response: any): T[] {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  if (Array.isArray(response?.items)) {
    return response.items;
  }

  return [];
}

/* =========================================================
   STATS
========================================================= */

async function fetchKpis(): Promise<KpiData> {
  const data = await apiFetch<DashboardStatsResponse>(
    "/api/v1/dashboard/stats"
  );

  return {
    totalLeads: numberValue(data.total_leads),
    qualified: numberValue(data.qualified),
    openDeals: numberValue(data.open_deals),
    won: numberValue(data.won),
    lost: numberValue(data.lost),
    revenue: numberValue(data.revenue),
    pipelineValue: numberValue(data.pipeline_value),
    avgDealSize: numberValue(data.avg_deal_size),
    conversionRate: numberValue(data.conversion_rate),
    tasksToday: numberValue(data.tasks_today),

    // Backend stats endpoint currently doesn't return meetings.
    upcomingMeetings: 0,
  };
}

/* =========================================================
   REVENUE CHART
========================================================= */

async function fetchMonthlyRevenue(): Promise<RevenueItem[]> {
  const response = await apiFetch<any>(
    "/api/v1/dashboard/revenue-chart"
  );

  const rows = extractArray<any>(response);

  return rows.map((item, index) => ({
    label: stringValue(
      item.label ??
        item.month ??
        item.month_name ??
        item.period ??
        item.name,
      `Month ${index + 1}`
    ),

    revenue: numberValue(
      item.revenue ??
        item.amount ??
        item.value ??
        item.total_revenue
    ),

    deals:
      item.deals !== undefined
        ? numberValue(item.deals)
        : item.deal_count !== undefined
          ? numberValue(item.deal_count)
          : undefined,
  }));
}

/* =========================================================
   LEAD SOURCES
========================================================= */

async function fetchSources(): Promise<SourceItem[]> {
  const response = await apiFetch<any>(
    "/api/v1/dashboard/lead-sources"
  );

  const rows = extractArray<any>(response);

  return rows.map((item) => ({
    name: stringValue(
      item.name ??
        item.source ??
        item.label,
      "Unknown"
    ),

    value: numberValue(
      item.value ??
        item.count ??
        item.lead_count ??
        item.total
    ),
  }));
}

/* =========================================================
   FUNNEL
========================================================= */

async function fetchFunnel(): Promise<FunnelItem[]> {
  const response = await apiFetch<any>(
    "/api/v1/dashboard/funnel"
  );

  const rows = extractArray<any>(response);

  return rows.map((item) => ({
    stage: stringValue(
      item.stage ??
        item.name ??
        item.label,
      "Unknown"
    ),

    value: numberValue(
      item.value ??
        item.count ??
        item.lead_count ??
        item.total
    ),
  }));
}

/* =========================================================
   RECENT ACTIVITY
========================================================= */

async function fetchRecentActivities(): Promise<ActivityItem[]> {
  const response = await apiFetch<any>(
    "/api/v1/dashboard/recent-activity"
  );

  const rows = extractArray<any>(response);

  return rows.map((item, index) => ({
    id: item.id ?? index,

    action: item.action,

    description:
      item.description ??
      item.message ??
      item.activity ??
      item.action,

    entity_type: item.entity_type,

    created_at:
      item.created_at ??
      item.timestamp ??
      item.date,

    actor_id: item.actor_id,
  }));
}

/* =========================================================
   PIPELINE
========================================================= */

async function fetchPipeline(): Promise<PipelineItem[]> {
  const response = await apiFetch<any>(
    "/api/v1/dashboard/pipeline"
  );

  const rows = extractArray<any>(response);

  return rows.map((item) => ({
    stage: stringValue(
      item.stage ??
        item.pipeline_stage ??
        item.name ??
        item.label,
      "Unknown"
    ),

    count: numberValue(
      item.count ??
        item.proposal_count ??
        item.deal_count ??
        item.total
    ),

    value: numberValue(
      item.value ??
        item.pipeline_value ??
        item.amount ??
        item.total_value
    ),
  }));
}

/* =========================================================
   TOP PERFORMERS
========================================================= */

async function fetchTopPerformers(): Promise<PerformerItem[]> {
  const response = await apiFetch<any>(
    "/api/v1/dashboard/top-performers"
  );

  /*
   Backend may return:

   [
     {
       name: "...",
       revenue: 10000
     }
   ]

   or:

   {
     performers: [...]
   }

   or:

   {
     top_performers: [...]
   }

   or an object containing owners/sources.
  */

  let rows: any[] = [];

  if (Array.isArray(response)) {
    rows = response;
  } else if (Array.isArray(response?.performers)) {
    rows = response.performers;
  } else if (Array.isArray(response?.top_performers)) {
    rows = response.top_performers;
  } else if (Array.isArray(response?.owners)) {
    rows = response.owners;
  } else {
    rows = extractArray(response);
  }

  return rows.map((item, index) => ({
    name: stringValue(
      item.name ??
        item.owner_name ??
        item.user_name ??
        item.full_name ??
        item.owner ??
        item.source,
      `Performer ${index + 1}`
    ),

    revenue: numberValue(
      item.revenue ??
        item.total_revenue ??
        item.amount ??
        item.value
    ),

    deals:
      item.deals !== undefined
        ? numberValue(item.deals)
        : item.deal_count !== undefined
          ? numberValue(item.deal_count)
          : undefined,

    source:
      item.source ??
      item.source_name,

    lead_count:
      item.lead_count !== undefined
        ? numberValue(item.lead_count)
        : item.leads !== undefined
          ? numberValue(item.leads)
          : undefined,
  }));
}

/* =========================================================
   CHART COLORS
========================================================= */

const CHART_RAW = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

/* =========================================================
   FORMATTERS
========================================================= */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatStage(stage: string) {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/* =========================================================
   KPI CARD
========================================================= */

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: {
    dir: "up" | "down";
    value: string;
  };
  accent?: string;
}) {
  return (
    <Card className="shadow-card hover:shadow-elegant transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {title}
            </p>

            <p
              className="text-2xl font-bold mt-1.5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {value}
            </p>

            {hint && (
              <p className="text-xs text-muted-foreground mt-1">
                {hint}
              </p>
            )}
          </div>

          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              accent ?? "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {trend && (
          <div className="mt-3 flex items-center gap-1 text-xs">
            {trend.dir === "up" ? (
              <ArrowUpRight className="h-3 w-3 text-success" />
            ) : (
              <ArrowDownRight className="h-3 w-3 text-destructive" />
            )}

            <span
              className={
                trend.dir === "up"
                  ? "text-success"
                  : "text-destructive"
              }
            >
              {trend.value}
            </span>

            <span className="text-muted-foreground">
              vs last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* =========================================================
   KPI WIDGETS
========================================================= */

type KpiSpec = {
  id: string;
  title: string;
  get: (k: KpiData | undefined) => string;
  icon: any;
  accent?: string;
  to?: string;
  search?: Record<string, string>;
};

const KPI_WIDGETS: KpiSpec[] = [
  {
    id: "totalLeads",
    title: "Total Leads",
    get: (k) => String(k?.totalLeads ?? 0),
    icon: Users,
    accent: "bg-primary/10 text-primary",
    to: "/leads",
  },

  {
    id: "qualified",
    title: "Qualified",
    get: (k) => String(k?.qualified ?? 0),
    icon: Target,
    accent: "bg-info/10 text-info",
    to: "/leads",
    search: { status: "qualified" },
  },

  {
    id: "openDeals",
    title: "Open Deals",
    get: (k) => String(k?.openDeals ?? 0),
    icon: TrendingUp,
    accent: "bg-warning/10 text-warning",
    to: "/pipeline",
  },

  {
    id: "won",
    title: "Won",
    get: (k) => String(k?.won ?? 0),
    icon: Trophy,
    accent: "bg-success/10 text-success",
    to: "/leads",
    search: { status: "won" },
  },

  {
    id: "lost",
    title: "Lost",
    get: (k) => String(k?.lost ?? 0),
    icon: XCircle,
    accent: "bg-destructive/10 text-destructive",
    to: "/leads",
    search: { status: "lost" },
  },

  {
    id: "revenue",
    title: "Revenue",
    get: (k) => formatCurrency(k?.revenue ?? 0),
    icon: DollarSign,
    accent: "bg-success/10 text-success",
  },

  {
    id: "pipelineValue",
    title: "Pipeline Value",
    get: (k) => formatCurrency(k?.pipelineValue ?? 0),
    icon: TrendingUp,
    to: "/pipeline",
  },

  {
    id: "avgDealSize",
    title: "Avg Deal Size",
    get: (k) => formatCurrency(k?.avgDealSize ?? 0),
    icon: DollarSign,
  },

  {
    id: "conversionRate",
    title: "Conversion",
    get: (k) => `${(k?.conversionRate ?? 0).toFixed(1)}%`,
    icon: Target,
  },

  {
    id: "tasksToday",
    title: "Tasks Today",
    get: (k) => String(k?.tasksToday ?? 0),
    icon: CheckSquare,
    to: "/tasks",
    search: { filter: "today" },
  },
];

/* =========================================================
   SORTABLE KPI
========================================================= */

function SortableKpi({
  spec,
  kpi,
  hidden,
  onHide,
  editing,
}: {
  spec: KpiSpec;
  kpi: KpiData | undefined;
  hidden: boolean;
  onHide: () => void;
  editing: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: spec.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (hidden) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${
        editing ? "ring-2 ring-primary/30 rounded-xl" : ""
      }`}
    >
      {editing && (
        <div className="absolute top-1 right-1 z-10 flex gap-0.5">
          <button
            {...attributes}
            {...listeners}
            className="h-6 w-6 rounded bg-background border shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" />
          </button>

          <button
            onClick={onHide}
            className="h-6 w-6 rounded bg-background border shadow-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
            title="Hide widget"
          >
            <EyeOff className="h-3 w-3" />
          </button>
        </div>
      )}

      {spec.to && !editing ? (
        <Link
          to={spec.to}
          search={spec.search as never}
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <KpiCard
            title={spec.title}
            value={spec.get(kpi)}
            icon={spec.icon}
            accent={spec.accent}
          />
        </Link>
      ) : (
        <KpiCard
          title={spec.title}
          value={spec.get(kpi)}
          icon={spec.icon}
          accent={spec.accent}
        />
      )}
    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {
  const [editing, setEditing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(
    KPI_WIDGETS.map((w) => w.id)
  );
  const [hidden, setHidden] = useState<string[]>([]);
  const [signupTenant, setSignupTenant] = useState<any>(null);

  /* =======================================================
     API QUERIES
  ======================================================= */

  const {
    data: kpi,
    isLoading: kpiLoading,
    isError: kpiError,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchKpis,
  });

  const {
    data: monthly = [],
    isLoading: monthlyLoading,
  } = useQuery({
    queryKey: ["dashboard-revenue"],
    queryFn: fetchMonthlyRevenue,
  });

  const {
    data: sources = [],
    isLoading: sourcesLoading,
  } = useQuery({
    queryKey: ["dashboard-lead-sources"],
    queryFn: fetchSources,
  });

  const {
    data: funnel = [],
    isLoading: funnelLoading,
  } = useQuery({
    queryKey: ["dashboard-funnel"],
    queryFn: fetchFunnel,
  });

  const {
    data: activities = [],
    isLoading: activitiesLoading,
  } = useQuery({
    queryKey: ["dashboard-activities"],
    queryFn: fetchRecentActivities,
  });

  const {
    data: pipeline = [],
    isLoading: pipelineLoading,
  } = useQuery({
    queryKey: ["dashboard-pipeline"],
    queryFn: fetchPipeline,
  });

  const {
    data: performers = [],
    isLoading: performersLoading,
  } = useQuery({
    queryKey: ["dashboard-top-performers"],
    queryFn: fetchTopPerformers,
  });

  /* =======================================================
     REALTIME
  ======================================================= */

  useRealtimeTable("leads", [
    ["dashboard-stats"],
    ["dashboard-funnel"],
    ["dashboard-lead-sources"],
    ["dashboard-revenue"],
    ["dashboard-pipeline"],
  ]);

  useRealtimeTable("tasks", [["dashboard-stats"]]);

  useRealtimeTable("meetings", [["dashboard-stats"]]);

  useRealtimeTable("it_tickets", [["dashboard-stats"]]);

  useRealtimeTable("activities", [["dashboard-activities"]]);

  /* =======================================================
     SIGNUP TENANT
  ======================================================= */

  useEffect(() => {
    const storedTenant =
      sessionStorage.getItem("signup_tenant");

    if (storedTenant) {
      try {
        setSignupTenant(JSON.parse(storedTenant));
      } catch (error) {
        console.error(
          "Failed to read signup tenant:",
          error
        );
      }
    }
  }, []);

  /* =======================================================
     LOAD SAVED DASHBOARD LAYOUT
  ======================================================= */

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await (supabase as any)
        .from("dashboard_layouts")
        .select("layout, hidden_widgets")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.layout?.order) {
        setOrder(
          data.layout.order
            .filter((id: string) =>
              KPI_WIDGETS.some((w) => w.id === id)
            )
            .concat(
              KPI_WIDGETS.map((w) => w.id).filter(
                (id) =>
                  !data.layout.order.includes(id)
              )
            )
        );
      }

      if (Array.isArray(data?.hidden_widgets)) {
        setHidden(data.hidden_widgets);
      }
    })();
  }, []);

  /* =======================================================
     SAVE LAYOUT
  ======================================================= */

  const saveLayout = async (
    nextOrder: string[],
    nextHidden: string[]
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await (supabase as any)
      .from("dashboard_layouts")
      .upsert({
        user_id: user.id,
        layout: {
          order: nextOrder,
        },
        hidden_widgets: nextHidden,
      });
  };

  /* =======================================================
     DRAG / DROP
  ======================================================= */

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;

    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(
      String(active.id)
    );

    const newIndex = order.indexOf(
      String(over.id)
    );

    const next = arrayMove(
      order,
      oldIndex,
      newIndex
    );

    setOrder(next);
    saveLayout(next, hidden);
  };

  const hideWidget = (id: string) => {
    const next = [...hidden, id];

    setHidden(next);

    saveLayout(order, next);
  };

  const showAll = () => {
    setHidden([]);

    saveLayout(order, []);
  };

  const resetLayout = () => {
    const def = KPI_WIDGETS.map((w) => w.id);

    setOrder(def);
    setHidden([]);

    saveLayout(def, []);
  };

  const orderedSpecs = useMemo(
    () =>
      order
        .map((id) =>
          KPI_WIDGETS.find(
            (w) => w.id === id
          )
        )
        .filter(Boolean) as KpiSpec[],
    [order]
  );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="space-y-6">
      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">
            Dashboard
          </h1>

          <p className="text-muted-foreground text-sm mt-1">
            Real-time overview of all CRM pipelines
            and performance.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="gap-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Live
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="gap-2"
          >
            <Search className="h-3.5 w-3.5" />

            <span className="hidden sm:inline">
              Search
            </span>

            <kbd className="hidden md:inline text-[10px] px-1 py-0.5 rounded border bg-muted">
              ⌘K
            </kbd>
          </Button>

          <NotificationsButton />

          <Button
            variant={
              editing
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() =>
              setEditing(!editing)
            }
            className="gap-2"
          >
            <Settings2 className="h-3.5 w-3.5" />

            {editing
              ? "Done"
              : "Customize"}
          </Button>

          {editing &&
            hidden.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={showAll}
                className="gap-2"
              >
                <Eye className="h-3.5 w-3.5" />

                Show all ({hidden.length})
              </Button>
            )}

          {editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetLayout}
              className="gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />

              Reset
            </Button>
          )}
        </div>
      </div>

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />

      {/* ===================================================
          API ERROR
      =================================================== */}

      {kpiError && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">
              Failed to load dashboard statistics.
              Please check your backend/API connection.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===================================================
          KPI ROW
      =================================================== */}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={order}
          strategy={horizontalListSortingStrategy}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {orderedSpecs.map((spec) => (
              <SortableKpi
                key={spec.id}
                spec={spec}
                kpi={kpi}
                hidden={hidden.includes(
                  spec.id
                )}
                onHide={() =>
                  hideWidget(spec.id)
                }
                editing={editing}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* ===================================================
          MONTHLY REVENUE + LEAD SOURCES
      =================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue */}

        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              Monthly Revenue
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-72">
              {monthlyLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading revenue...
                </div>
              ) : (
                <ResponsiveContainer>
                  <AreaChart
                    data={monthly}
                  >
                    <defs>
                      <linearGradient
                        id="rev"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={
                            CHART_RAW[0]
                          }
                          stopOpacity={0.4}
                        />

                        <stop
                          offset="100%"
                          stopColor={
                            CHART_RAW[0]
                          }
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.3}
                    />

                    <XAxis
                      dataKey="label"
                      fontSize={12}
                    />

                    <YAxis
                      fontSize={12}
                      tickFormatter={(v) =>
                        `$${v / 1000}k`
                      }
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "var(--popover)",
                        border:
                          "1px solid var(--border)",
                        borderRadius: 8,
                        color:
                          "var(--popover-foreground)",
                      }}
                      labelStyle={{
                        color:
                          "var(--popover-foreground)",
                      }}
                      itemStyle={{
                        color:
                          "var(--popover-foreground)",
                      }}
                      formatter={(v: number) =>
                        formatCurrency(v)
                      }
                    />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={
                        CHART_RAW[0]
                      }
                      fill="url(#rev)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lead Sources */}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              Lead Sources
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-72">
              {sourcesLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading sources...
                </div>
              ) : sources.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No lead source data.
                </div>
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={sources}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {sources.map(
                        (_, i) => (
                          <Cell
                            key={i}
                            fill={
                              CHART_RAW[
                                i %
                                  CHART_RAW.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        background:
                          "var(--popover)",
                        border:
                          "1px solid var(--border)",
                        borderRadius: 8,
                        color:
                          "var(--popover-foreground)",
                      }}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: 12,
                        color:
                          "var(--foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===================================================
          FUNNEL + RECENT ACTIVITY
      =================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel */}

        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              Sales Funnel
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-72">
              {funnelLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading funnel...
                </div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={funnel}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.3}
                    />

                    <XAxis
                      dataKey="stage"
                      fontSize={12}
                      tickFormatter={
                        formatStage
                      }
                    />

                    <YAxis fontSize={12} />

                    <Tooltip
                      contentStyle={{
                        background:
                          "var(--popover)",
                        border:
                          "1px solid var(--border)",
                        borderRadius: 8,
                        color:
                          "var(--popover-foreground)",
                      }}
                    />

                    <Bar
                      dataKey="value"
                      fill={CHART_RAW[0]}
                      radius={[
                        6,
                        6,
                        0,
                        0,
                      ]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">
              Recent Activity
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {activitiesLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Loading activity...
                </p>
              ) : activities.length ===
                0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No activity yet.
                </p>
              ) : (
                activities.map((a) => (
                  <div
                    key={a.id}
                    className="flex gap-3 text-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        {a.description ||
                          a.action ||
                          "Activity"}
                      </p>

                      {a.created_at && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            a.created_at
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===================================================
          PIPELINE
      =================================================== */}

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Pipeline Overview
          </CardTitle>

          <Link to="/pipeline">
            <Button
              variant="outline"
              size="sm"
            >
              View Pipeline
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {pipelineLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading pipeline...
            </div>
          ) : pipeline.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No pipeline data available.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {pipeline.map(
                (item, index) => (
                  <div
                    key={`${item.stage}-${index}`}
                    className="rounded-lg border p-4"
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {formatStage(
                        item.stage
                      )}
                    </p>

                    <p className="text-2xl font-bold mt-2">
                      {item.count}
                    </p>

                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(
                        item.value
                      )}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================================================
          TOP PERFORMERS
      =================================================== */}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">
            Top Performers
          </CardTitle>
        </CardHeader>

        <CardContent>
          {performersLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading top performers...
            </div>
          ) : performers.length ===
            0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No performer data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-125">
                <div className="grid grid-cols-4 gap-4 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <span>
                    Performer
                  </span>

                  <span>
                    Revenue
                  </span>

                  <span>
                    Deals
                  </span>

                  <span>
                    Leads
                  </span>
                </div>

                <div className="divide-y">
                  {performers.map(
                    (performer, index) => (
                      <div
                        key={`${performer.name}-${index}`}
                        className="grid grid-cols-4 gap-4 px-4 py-4 items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                            {performer.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-medium text-sm">
                              {
                                performer.name
                              }
                            </p>

                            {performer.source && (
                              <p className="text-xs text-muted-foreground">
                                {
                                  performer.source
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        <p className="text-sm font-medium">
                          {formatCurrency(
                            performer.revenue
                          )}
                        </p>

                        <p className="text-sm">
                          {performer.deals ??
                            "—"}
                        </p>

                        <p className="text-sm">
                          {performer.lead_count ??
                            "—"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================================================
          SIGNUP SUCCESS MODAL
      =================================================== */}

      {signupTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[90%] max-w-md rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-bold">
                Welcome {signupTenant.name}! 🎉
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Your CRM account has been
                created successfully.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Aapka Webhook URL:
              </label>

              <div className="flex gap-2">
                <input
                  readOnly
                  value={
                    signupTenant.webhook_url
                  }
                  className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm"
                />

                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      signupTenant.webhook_url
                    );

                    toast.success(
                      "Webhook URL copied!"
                    );
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => {
                  sessionStorage.removeItem(
                    "signup_tenant"
                  );

                  setSignupTenant(null);
                }}
              >
                Continue to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}