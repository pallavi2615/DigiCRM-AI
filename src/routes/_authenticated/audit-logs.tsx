import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { logAccessDenied } from "@/lib/audit";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, ScrollText, ShieldAlert, Download, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { useAuth } from "@/hooks/use-auth";
import { escapePostgrestFilterValue } from "@/lib/utils";
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


export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — DigiCRM AI" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="audit-logs" label="Audit Logs">
      <AuditLogsPage />
    </RoleGuard>
  ),
});

interface Activity {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const actionColors: Record<string, string> = {
  created: "bg-success/15 text-success",
  updated: "bg-info/15 text-info",
  deleted: "bg-destructive/15 text-destructive",
  access_denied: "bg-warning/15 text-warning",
};

const REDACT_KEYS = new Set(["password", "password_hash", "token", "access_token", "refresh_token", "api_key", "secret", "otp", "ssn", "aadhaar", "pan"]);
function redact(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") return v.length > 240 ? v.slice(0, 240) + "…" : v;
  return v;
}
function fmt(v: unknown): string {
  if (v == null) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function AuditLogsPage() {
  const { isAdmin, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [rowIdFilter, setRowIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loading && !isAdmin) {
      logAccessDenied("audit-logs", "view", null, "non-admin");
    }
  }, [loading, isAdmin]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", search, entityFilter, actionFilter, userFilter, rowIdFilter, dateFrom, dateTo],
    enabled: isAdmin,
    queryFn: async () => {
      let q = supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(500);
      if (entityFilter !== "all") q = q.eq("entity_type", entityFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (userFilter !== "all") q = q.eq("actor_id", userFilter);
      if (rowIdFilter.trim()) q = q.eq("entity_id", rowIdFilter.trim());
      if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) q = q.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());
      if (search) q = q.ilike("description", `%${escapePostgrestFilterValue(search)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
  });
  const nameOf = (id: string | null) => {
    if (!id) return "System";
    const p = profiles?.find(x => x.id === id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };

  const entityOptions = useMemo(() => {
    const s = new Set<string>(["leads","contacts","companies","tasks","meetings"]);
    logs?.forEach(l => s.add(l.entity_type));
    return Array.from(s).sort();
  }, [logs]);

  const changes = (a: Activity): Array<{ field: string; from: unknown; to: unknown }> => {
    const m = a.metadata as { changes?: Record<string, { from: unknown; to: unknown }> } | null;
    if (!m?.changes) return [];
    return Object.entries(m.changes)
      .filter(([k]) => !["updated_at"].includes(k))
      .map(([field, v]) => ({
        field,
        from: REDACT_KEYS.has(field) ? "«redacted»" : redact(v.from),
        to: REDACT_KEYS.has(field) ? "«redacted»" : redact(v.to),
      }));
  };

  const changesSummary = (a: Activity) => {
    const c = changes(a);
    if (!c.length) return null;
    return c.slice(0, 3).map(x => x.field).join(", ") + (c.length > 3 ? ` +${c.length - 3}` : "");
  };

  const snapshot = (a: Activity) => {
    if (a.action !== "created" && a.action !== "deleted") return null;
    const m = a.metadata as Record<string, unknown> | null;
    if (!m || m.changes) return null;
    return Object.entries(m)
      .filter(([k]) => !["created_at","updated_at","changes"].includes(k))
      .slice(0, 20)
      .map(([k, v]) => ({ field: k, value: REDACT_KEYS.has(k) ? "«redacted»" : redact(v) }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ScrollText className="h-7 w-7 text-primary" /> Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin ? "Full change history across the workspace with before/after diffs." : "Your recent activity across the workspace."}
        </p>
      </div>

      {!isAdmin ? (
        <Card className="border-destructive/40 bg-destructive/5" data-testid="audit-access-denied">
          <CardContent className="p-6 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Access restricted</p>
              <p className="text-sm text-muted-foreground mt-1">
                Workspace-wide audit logs are visible to Admins and Super Admins only. Ask your administrator for access.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (

      <Card className="shadow-card">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search description..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {entityOptions.map(e => (
                  <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {["created","updated","deleted","access_denied"].map(a => (
                  <SelectItem key={a} value={a} className="capitalize">{a.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue placeholder="User" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {profiles?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Row ID (uuid)…" value={rowIdFilter} onChange={(e) => setRowIdFilter(e.target.value)} />
            {/* <Input type="DatePicker" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
            <Input type="DatePicker" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" /> */}
            <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="From date"
              />
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder="To date"
              />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{logs?.length ?? 0} entries (max 500)</p>
            <Button
              variant="outline"
              size="sm"
              data-testid="audit-export-btn"
              disabled={!logs || logs.length === 0}
              onClick={() => {
                const rows = (logs ?? []).map(a => ({
                  timestamp: a.created_at,
                  user: nameOf(a.actor_id),
                  table: a.entity_type,
                  row_id: a.entity_id ?? "",
                  action: a.action,
                  description: a.description ?? "",
                  changed_fields: changesSummary(a) ?? "",
                }));
                downloadCsv(`audit-logs-${new Date().toISOString().slice(0,10)}.csv`,
                  objectsToCsv(rows, ["timestamp","user","table","row_id","action","description","changed_fields"]));
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Row</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>}
                {!isLoading && logs?.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground text-sm">No activity matches these filters.</TableCell></TableRow>
                )}
                {logs?.map(a => {
                  const summary = changesSummary(a);
                  const diff = changes(a);
                  const snap = snapshot(a);
                  const hasDetails = diff.length > 0 || (snap && snap.length > 0);
                  const isOpen = !!expanded[a.id];
                  return (
                    <>
                      <TableRow key={a.id} className={hasDetails ? "cursor-pointer" : ""} onClick={() => hasDetails && setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}>
                        <TableCell>{hasDetails ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-sm font-medium">{nameOf(a.actor_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{a.entity_type}</Badge></TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{a.entity_id?.slice(0, 8) ?? "—"}</TableCell>
                        <TableCell><Badge className={`${actionColors[a.action] ?? "bg-muted"} border-0 capitalize`}>{a.action.replace("_", " ")}</Badge></TableCell>
                        <TableCell className="text-sm">
                          <div>{a.description}</div>
                          {summary && <div className="text-xs text-muted-foreground mt-0.5">Changed: {summary}</div>}
                        </TableCell>
                      </TableRow>
                      {isOpen && hasDetails && (
                        <TableRow key={`${a.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            {diff.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field changes</p>
                                <div className="rounded border bg-background overflow-hidden">
                                  <Table>
                                    <TableHeader><TableRow>
                                      <TableHead className="w-40">Field</TableHead>
                                      <TableHead>Before</TableHead>
                                      <TableHead>After</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                      {diff.map(c => (
                                        <TableRow key={c.field}>
                                          <TableCell className="font-mono text-xs">{c.field}</TableCell>
                                          <TableCell className="text-xs text-destructive-foreground/80 bg-destructive/5"><code className="whitespace-pre-wrap break-all">{fmt(c.from)}</code></TableCell>
                                          <TableCell className="text-xs text-success-foreground/80 bg-success/5"><code className="whitespace-pre-wrap break-all">{fmt(c.to)}</code></TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                            {snap && snap.length > 0 && (
                              <div className="space-y-2 mt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.action === "created" ? "Created snapshot" : "Deleted snapshot"}</p>
                                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs rounded border bg-background p-3">
                                  {snap.map(s => (
                                    <div key={s.field} className="flex gap-2">
                                      <span className="font-mono text-muted-foreground">{s.field}:</span>
                                      <span className="truncate">{fmt(s.value)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
