import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * One workspace section (Leads, Tasks, Payments…) for a single industry.
 * Every list here is narrowed to the industry the person is working inside,
 * so nothing from another industry can appear on the page.
 */

export type IndustryModuleKey =
  | "leads" | "pipeline" | "contacts" | "companies"
  | "tasks" | "meetings" | "calendar" | "reports"
  | "documents" | "payments" | "tickets";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const STAGES = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"] as const;

export function IndustryModule({
  module,
  group,
  industryName,
}: {
  module: IndustryModuleKey;
  group: string;
  industryName: string;
}) {
  const q = useQuery({
    queryKey: ["industry-module", module, group, industryName],
    queryFn: () => loadModule(module, group, industryName),
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    );
  }
  if (q.isError) {
    return <p className="text-sm text-destructive">Unable to load this section. Please try again.</p>;
  }

  const rows = (q.data ?? []) as Row[];

  if (module === "pipeline") return <PipelineView rows={rows} />;
  if (module === "reports") return <ReportsView rows={rows} industryName={industryName} />;
  if (module === "calendar") return <CalendarView rows={rows} />;

  return <ListView module={module} rows={rows} industryName={industryName} />;
}

type Row = Record<string, unknown>;

async function loadModule(module: IndustryModuleKey, group: string, industryName: string): Promise<Row[]> {
  const packRecordIds = async () => {
    const { data, error } = await supabase
      .from("pack_records")
      .select("id, title")
      .eq("group_slug", group)
      .is("deleted_at", null)
      .limit(500);
    if (error) throw error;
    return data ?? [];
  };

  switch (module) {
    case "leads":
    case "pipeline":
    case "reports": {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, contact_person, email, phone, status, priority, estimated_value, created_at")
        .eq("industry", industryName)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    }
    case "contacts": {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, designation, created_at")
        .eq("industry_group", group)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    }
    case "companies": {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, city, phone, email, website, created_at")
        .eq("industry_group", group)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    }
    case "tasks": {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, priority, due_date, created_at")
        .eq("industry_group", group)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    }
    case "meetings":
    case "calendar": {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, status, starts_at, ends_at, location")
        .eq("industry_group", group)
        .order("starts_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    }
    case "tickets": {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, requester_name, created_at")
        .eq("industry_group", group)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    }
    case "documents": {
      const recs = await packRecordIds();
      if (!recs.length) return [];
      const titles = new Map(recs.map((r) => [r.id as string, r.title as string]));
      const { data, error } = await supabase
        .from("pack_documents")
        .select("id, record_id, name, doc_type, status, created_at")
        .in("record_id", recs.map((r) => r.id as string))
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, record_title: titles.get(d.record_id as string) ?? "—" }));
    }
    case "payments": {
      const recs = await packRecordIds();
      if (!recs.length) return [];
      const titles = new Map(recs.map((r) => [r.id as string, r.title as string]));
      const { data, error } = await supabase
        .from("pack_payments")
        .select("id, record_id, label, kind, amount, status, method, due_date, paid_at, reference")
        .in("record_id", recs.map((r) => r.id as string))
        .order("due_date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, record_title: titles.get(p.record_id as string) ?? "—" }));
    }
  }
}

interface ColumnDef { key: string; label: string; render?: (r: Row) => React.ReactNode; align?: "right" }

const COLUMNS: Record<string, ColumnDef[]> = {
  leads: [
    { key: "company_name", label: "Company" },
    { key: "contact_person", label: "Contact" },
    { key: "status", label: "Stage", render: (r) => <Badge variant="secondary" className="capitalize">{String(r["status"] ?? "").replace("_", " ")}</Badge> },
    { key: "priority", label: "Priority", render: (r) => <span className="capitalize">{String(r["priority"] ?? "—")}</span> },
    { key: "estimated_value", label: "Value", align: "right", render: (r) => (r["estimated_value"] ? inr(Number(r["estimated_value"])) : "—") },
  ],
  contacts: [
    { key: "name", label: "Name", render: (r) => `${r["first_name"] ?? ""} ${r["last_name"] ?? ""}`.trim() || "—" },
    { key: "designation", label: "Role" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
  ],
  companies: [
    { key: "name", label: "Company" },
    { key: "city", label: "City" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
  ],
  tasks: [
    { key: "title", label: "Task" },
    { key: "status", label: "Status", render: (r) => <Badge variant="secondary" className="capitalize">{String(r["status"] ?? "").replace("_", " ")}</Badge> },
    { key: "priority", label: "Priority", render: (r) => <span className="capitalize">{String(r["priority"] ?? "—")}</span> },
    { key: "due_date", label: "Due", render: (r) => day(r["due_date"] as string) },
  ],
  meetings: [
    { key: "title", label: "Meeting" },
    { key: "starts_at", label: "When", render: (r) => (r["starts_at"] ? new Date(r["starts_at"] as string).toLocaleString("en-IN") : "—") },
    { key: "location", label: "Where" },
    { key: "status", label: "Status", render: (r) => <Badge variant="secondary" className="capitalize">{String(r["status"] ?? "")}</Badge> },
  ],
  tickets: [
    { key: "ticket_number", label: "Ref" },
    { key: "subject", label: "Subject" },
    { key: "requester_name", label: "Raised by" },
    { key: "status", label: "Status", render: (r) => <Badge variant="secondary" className="capitalize">{String(r["status"] ?? "")}</Badge> },
    { key: "priority", label: "Priority", render: (r) => <span className="capitalize">{String(r["priority"] ?? "—")}</span> },
  ],
  documents: [
    { key: "name", label: "Document" },
    { key: "record_title", label: "Application" },
    { key: "doc_type", label: "Type" },
    { key: "status", label: "Status", render: (r) => <Badge variant={r["status"] === "verified" ? "default" : "secondary"} className="capitalize">{String(r["status"] ?? "")}</Badge> },
    { key: "created_at", label: "Uploaded", render: (r) => day(r["created_at"] as string) },
  ],
  payments: [
    { key: "label", label: "Charge" },
    { key: "record_title", label: "Application" },
    { key: "method", label: "Method", render: (r) => <span className="capitalize">{String(r["method"] ?? "—")}</span> },
    { key: "status", label: "Status", render: (r) => <Badge variant={r["status"] === "paid" ? "default" : "secondary"} className="capitalize">{String(r["status"] ?? "").replace("_", " ")}</Badge> },
    { key: "amount", label: "Amount", align: "right", render: (r) => inr(Number(r["amount"] ?? 0)) },
  ],
};

const EMPTY: Record<string, string> = {
  leads: "No leads in this industry yet.",
  contacts: "No contacts in this industry yet.",
  companies: "No companies in this industry yet.",
  tasks: "No tasks in this industry yet.",
  meetings: "No meetings scheduled for this industry.",
  tickets: "No support tickets for this industry.",
  documents: "No client documents uploaded for this industry yet.",
  payments: "No fees or payments recorded for this industry yet.",
};

function ListView({ module, rows, industryName }: { module: IndustryModuleKey; rows: Row[]; industryName: string }) {
  const cols = COLUMNS[module] ?? [];
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base capitalize">{module} · {industryName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{EMPTY[module]}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c) => <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={(r["id"] as string) ?? i}>
                  {cols.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" ? "text-right" : ""}>
                      {c.render ? c.render(r) : ((r[c.key] as string) ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PipelineView({ rows }: { rows: Row[] }) {
  const byStage = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const s of STAGES) map[s] = [];
    for (const r of rows) {
      const s = String(r["status"] ?? "new");
      (map[s] ??= []).push(r);
    }
    return map;
  }, [rows]);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {STAGES.map((s) => {
        const list = byStage[s] ?? [];
        const value = list.reduce((sum, r) => sum + Number(r["estimated_value"] ?? 0), 0);
        return (
          <Card key={s} className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize flex items-center justify-between">
                <span>{s.replace("_", " ")}</span>
                <Badge variant="outline">{list.length}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{inr(value)}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.length === 0 && <p className="text-xs text-muted-foreground">Nothing here.</p>}
              {list.slice(0, 12).map((r) => (
                <div key={r["id"] as string} className="rounded-md border p-2">
                  <p className="text-sm font-medium">{String(r["company_name"] ?? "—")}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(r["contact_person"] ?? "—")} · {r["estimated_value"] ? inr(Number(r["estimated_value"])) : "—"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CalendarView({ rows }: { rows: Row[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const k = r["starts_at"] ? new Date(r["starts_at"] as string).toDateString() : "Unscheduled";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  if (!grouped.length) return <p className="p-10 text-center text-sm text-muted-foreground">Nothing on the calendar for this industry yet.</p>;

  return (
    <div className="space-y-3">
      {grouped.map(([date, list]) => (
        <Card key={date} className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{date}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {list.map((r) => (
              <div key={r["id"] as string} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{String(r["title"] ?? "—")}</span>
                <span className="text-xs text-muted-foreground">
                  {r["starts_at"] ? new Date(r["starts_at"] as string).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}
                  {" · "}{String(r["status"] ?? "")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReportsView({ rows, industryName }: { rows: Row[]; industryName: string }) {
  const won = rows.filter((r) => r["status"] === "won");
  const lost = rows.filter((r) => r["status"] === "lost");
  const open = rows.length - won.length - lost.length;
  const wonValue = won.reduce((s, r) => s + Number(r["estimated_value"] ?? 0), 0);
  const pipelineValue = rows
    .filter((r) => r["status"] !== "won" && r["status"] !== "lost")
    .reduce((s, r) => s + Number(r["estimated_value"] ?? 0), 0);
  const conversion = rows.length ? Math.round((won.length / rows.length) * 100) : 0;

  const kpis = [
    { label: "Total leads", value: rows.length.toLocaleString() },
    { label: "Open", value: open.toLocaleString() },
    { label: "Won revenue", value: inr(wonValue) },
    { label: "Open pipeline", value: inr(pipelineValue) },
    { label: "Conversion", value: `${conversion}%` },
    { label: "Avg won deal", value: won.length ? inr(wonValue / won.length) : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3"><CardTitle className="text-base">{industryName} — deals by stage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">No data to report on yet.</p>}
          {rows.length > 0 && STAGES.map((s) => {
            const count = rows.filter((r) => r["status"] === s).length;
            return (
              <div key={s} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="capitalize">{s.replace("_", " ")}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <Progress value={(count / rows.length) * 100} className="h-1.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
