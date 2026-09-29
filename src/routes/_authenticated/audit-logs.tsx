import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Loader2, ScrollText, ShieldAlert, Download, ChevronDown, ChevronRight, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { DatePicker } from "@/components/ui/datetime-picker";
import { apiFetch, apiDownload } from "@/lib/api"; 

interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  table_name: string;
  row_id: string | null;
  action: string;
  description: string | null;
  changes: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  skip: number;
  limit: number;
}

interface FilterUser {
  id: number;
  name: string;
}

interface FilterOptions {
  tables: string[];
  actions: string[];
  users: FilterUser[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 100;

const actionColors: Record<string, string> = {
  created: "bg-success/15 text-success",
  updated: "bg-info/15 text-info",
  deleted: "bg-destructive/15 text-destructive",
  access_denied: "bg-warning/15 text-warning",
  access_granted: "bg-info/15 text-info",
};

const BASE_TABLES = ["leads", "contacts", "companies", "tasks", "meetings"];
const BASE_ACTIONS = ["created", "updated", "deleted", "access_denied"];

const REDACT_KEYS = new Set([
  "password", "password_hash", "token", "access_token", "refresh_token",
  "api_key", "secret", "otp", "ssn", "aadhaar", "pan",
]);

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

/** Turn a date (YYYY-MM-DD or full ISO) into an ISO date-time string. */
function toIso(d: string, endOfDay = false): string | null {
  if (!d || !d.trim()) return null;
  const value = d.length === 10 ? `${d}${endOfDay ? "T23:59:59" : "T00:00:00"}` : d;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return null;
  return date.toISOString();
}

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function isDiff(v: unknown): v is { from: unknown; to: unknown } {
  return !!v && typeof v === "object" && !Array.isArray(v) && ("from" in v || "to" in v);
}

interface Filters {
  search: string;
  table: string;
  action: string;
  userId: string;
  rowId: string;
  dateFrom: string;
  dateTo: string;
}

function buildParams(f: Filters, extra: Record<string, string | number> = {}) {
  const p = new URLSearchParams();
  if (f.search.trim()) p.set("search", f.search.trim());
  if (f.table !== "all") p.set("table", f.table);
  if (f.action !== "all") p.set("action", f.action);
  if (f.userId !== "all") p.set("user_id", f.userId);
  if (f.rowId.trim()) p.set("row_id", f.rowId.trim());
  const from = toIso(f.dateFrom);
  const to = toIso(f.dateTo, true);
  if (from) p.set("from_date", from);
  if (to) p.set("to_date", to);
  Object.entries(extra).forEach(([k, v]) => p.set(k, String(v)));
  return p;
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/_authenticated/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — DigiCRM AI" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="audit-logs" label="Audit Logs">
      <AuditLogsPage />
    </RoleGuard>
  ),
});

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function AuditLogsPage() {
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [rowIdFilter, setRowIdFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const debouncedRowId = useDebounced(rowIdFilter);

  const filters: Filters = {
    search: debouncedSearch,
    table: entityFilter,
    action: actionFilter,
    userId: userFilter,
    rowId: debouncedRowId,
    dateFrom,
    dateTo,
  };

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, entityFilter, actionFilter, userFilter, debouncedRowId, dateFrom, dateTo]);

  /* ---- Logs ---- */
  const { data: result, isLoading, error } = useQuery({
    queryKey: ["audit-logs", filters, page],
    enabled: isAdmin,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = buildParams(filters, { skip: page * PAGE_SIZE, limit: PAGE_SIZE });
      return apiFetch<AuditLogsResponse>(`/api/v1/audit-logs?${params.toString()}`);
    },
  });

  const logs = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ---- Dropdown options (tables, actions, users) ---- */
  const { data: filterOptions } = useQuery({
    queryKey: ["audit-logs-filter-options"],
    enabled: isAdmin,
    queryFn: async (): Promise<FilterOptions> => {
      const raw = await apiFetch<any>("/api/v1/audit-logs/filter-options");
      const users: FilterUser[] = (raw?.users ?? [])
        .map((u: any) => ({
          id: Number(u?.id ?? u?.user_id),
          name: u?.name ?? u?.full_name ?? u?.user_name ?? u?.email ?? String(u?.id ?? u?.user_id),
        }))
        .filter((u: FilterUser) => !Number.isNaN(u.id));
      return {
        tables: Array.isArray(raw?.tables) ? raw.tables : [],
        actions: Array.isArray(raw?.actions) ? raw.actions : [],
        users,
      };
    },
  });

  const entityOptions = useMemo(() => {
    const s = new Set<string>(BASE_TABLES);
    filterOptions?.tables.forEach((t) => s.add(t));
    logs.forEach((l) => s.add(l.table_name));
    return Array.from(s).sort();
  }, [filterOptions, logs]);

  const actionOptions = useMemo(() => {
    const s = new Set<string>(BASE_ACTIONS);
    filterOptions?.actions.forEach((a) => s.add(a));
    return Array.from(s);
  }, [filterOptions]);

  /* ---- Row helpers ---- */
  const changes = (a: AuditLog): Array<{ field: string; from: unknown; to: unknown }> => {
    if (!a.changes) return [];
    return Object.entries(a.changes)
      .filter(([k, v]) => k !== "updated_at" && isDiff(v))
      .map(([field, v]) => {
        const d = v as { from: unknown; to: unknown };
        return {
          field,
          from: REDACT_KEYS.has(field) ? "«redacted»" : redact(d.from),
          to: REDACT_KEYS.has(field) ? "«redacted»" : redact(d.to),
        };
      });
  };

  const changesSummary = (a: AuditLog) => {
    const c = changes(a);
    if (!c.length) return null;
    return c.slice(0, 3).map((x) => x.field).join(", ") + (c.length > 3 ? ` +${c.length - 3}` : "");
  };

  const snapshot = (a: AuditLog) => {
    if (a.action !== "created" && a.action !== "deleted") return null;
    if (!a.changes) return null;
    const entries = Object.entries(a.changes).filter(
      ([k, v]) => !["created_at", "updated_at"].includes(k) && !isDiff(v)
    );
    if (!entries.length) return null;
    return entries.slice(0, 20).map(([k, v]) => ({
      field: k,
      value: REDACT_KEYS.has(k) ? "«redacted»" : redact(v),
    }));
  };

  /* ---- Export ---- */
  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const params = buildParams(filters);
      const qs = params.toString();
      await apiDownload(
        `/api/v1/audit-logs/export${qs ? `?${qs}` : ""}`,
        `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  /* ---- Render ---- */
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ScrollText className="h-7 w-7 text-primary" /> Audit Logs
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin
            ? "Full change history across the workspace with before/after diffs."
            : "Your recent activity across the workspace."}
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
                <Input
                  placeholder="Search description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {entityOptions.map((e) => (
                    <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actionOptions.map((a) => (
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
                  {filterOptions?.users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Row ID (uuid)…"
                value={rowIdFilter}
                onChange={(e) => setRowIdFilter(e.target.value)}
              />
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" />
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" />
            </div>

            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {total} entries
                {total > 0 && ` · page ${page + 1} of ${totalPages}`}
              </p>
              <div className="flex items-center gap-2">
                {exportError && <span className="text-xs text-destructive">{exportError}</span>}
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="audit-export-btn"
                  disabled={exporting || total === 0}
                  onClick={handleExport}
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  )}
                  {error && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-destructive text-sm">
                        {error instanceof Error ? error.message : "Failed to load audit logs."}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !error && logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground text-sm">
                        No activity matches these filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((a) => {
                    const key = String(a.id);
                    const summary = changesSummary(a);
                    const diff = changes(a);
                    const snap = snapshot(a);
                    const hasDetails = diff.length > 0 || (snap && snap.length > 0);
                    const isOpen = !!expanded[key];
                    return (
                      <Fragment key={key}>
                        <TableRow
                          className={hasDetails ? "cursor-pointer" : ""}
                          onClick={() => hasDetails && setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                        >
                          <TableCell>
                            {hasDetails ? (
                              isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            ) : null}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(a.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{a.user_name || "System"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{a.table_name}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[10px] text-muted-foreground">
                            {a.row_id?.slice(0, 8) ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${actionColors[a.action] ?? "bg-muted"} border-0 capitalize`}>
                              {a.action.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{a.description}</div>
                            {summary && (
                              <div className="text-xs text-muted-foreground mt-0.5">Changed: {summary}</div>
                            )}
                          </TableCell>
                        </TableRow>

                        {isOpen && hasDetails && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="p-4">
                              {diff.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Field changes
                                  </p>
                                  <div className="rounded border bg-background overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-40">Field</TableHead>
                                          <TableHead>Before</TableHead>
                                          <TableHead>After</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {diff.map((c) => (
                                          <TableRow key={c.field}>
                                            <TableCell className="font-mono text-xs">{c.field}</TableCell>
                                            <TableCell className="text-xs text-destructive-foreground/80 bg-destructive/5">
                                              <code className="whitespace-pre-wrap break-all">{fmt(c.from)}</code>
                                            </TableCell>
                                            <TableCell className="text-xs text-success-foreground/80 bg-success/5">
                                              <code className="whitespace-pre-wrap break-all">{fmt(c.to)}</code>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}
                              {snap && snap.length > 0 && (
                                <div className="space-y-2 mt-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {a.action === "created" ? "Created snapshot" : "Deleted snapshot"}
                                  </p>
                                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs rounded border bg-background p-3">
                                    {snap.map((s) => (
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
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}