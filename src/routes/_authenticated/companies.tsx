import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiUpload, apiDownload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Pencil, Loader2, Building2, Globe, Upload, Download, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/companies")({
  head: () => ({ meta: [{ title: "Companies — DigiCRM AI" }] }),
  component: CompaniesPage,
});

const BASE = "/api/v1/companies";

interface Company {
  id: number;
  tenant_id?: number;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
}

interface ImportResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: unknown[];
}

const empty = {
  name: "", industry: "", website: "", phone: "", email: "",
  employee_count: 0, annual_revenue: 0, city: "", country: "", notes: "",
};

// FastAPI/Pydantic rejects "" for typed fields like EmailStr, so send null instead.
const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());

// The API may name these fields differently from the UI. On read, we take the
// first alias present in the response; on write, we send back using the key the
// API actually returned (defaults to the first alias if there are no rows yet).
// If your API uses another name, add it to the list below.
const ALIASES = {
  city: ["city", "location", "city_name"],
  country: ["country", "country_name"],
  employee_count: ["employee_count", "employees", "num_employees", "no_of_employees", "company_size", "size"],
  annual_revenue: ["annual_revenue", "revenue", "annual_turnover", "turnover"],
} as const;

type AliasField = keyof typeof ALIASES;

const writeKeys: Record<AliasField, string> = {
  city: ALIASES.city[0],
  country: ALIASES.country[0],
  employee_count: ALIASES.employee_count[0],
  annual_revenue: ALIASES.annual_revenue[0],
};

// True when the API only has a single `location` string (no separate country).
// Then we show it as City + Country in the UI ("Noida, India" → Noida / India)
// and join them back into one string when saving.
let combinedLocation = false;

function normalize(row: Record<string, unknown>): Company {
  const out: Record<string, unknown> = { ...row };
  for (const field of Object.keys(ALIASES) as AliasField[]) {
    const found = ALIASES[field].find((k) => row[k] !== undefined);
    if (found) writeKeys[field] = found;
    out[field] = found ? row[found] : null;
  }

  const hasCountryKey = ALIASES.country.some((k) => row[k] !== undefined);
  if (row.location !== undefined && !hasCountryKey) {
    combinedLocation = true;
    writeKeys.city = "location";
    const raw = row.location ? String(row.location) : "";
    const idx = raw.lastIndexOf(",");
    if (idx >= 0) {
      out.city = raw.slice(0, idx).trim() || null;
      out.country = raw.slice(idx + 1).trim() || null;
    } else {
      out.city = raw.trim() || null;
      out.country = null;
    }
  }
  return out as unknown as Company;
}

function toPayload(form: typeof empty) {
  const location = combinedLocation
    ? {
        [writeKeys.city]: nullIfEmpty(
          [form.city.trim(), form.country.trim()].filter(Boolean).join(", "),
        ),
      }
    : {
        [writeKeys.city]: nullIfEmpty(form.city),
        [writeKeys.country]: nullIfEmpty(form.country),
      };

  return {
    name: form.name.trim(),
    industry: nullIfEmpty(form.industry),
    website: nullIfEmpty(form.website),
    phone: nullIfEmpty(form.phone),
    email: nullIfEmpty(form.email),
    notes: nullIfEmpty(form.notes),
    [writeKeys.employee_count]: Number(form.employee_count) || null,
    [writeKeys.annual_revenue]: Number(form.annual_revenue) || null,
    ...location,
  };
}

const formatRevenue = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : null;
};

function CompaniesPage() {
  const perms = usePermissions();
  const { hasRole, loading: authLoading } = useAuth();
  // super admins get read-only access here; also stay read-only until auth has loaded
  const isSuperAdmin = authLoading || hasRole("super_admin");
  const canCreate = !isSuperAdmin && perms.canCreate("companies");
  const canEdit = !isSuperAdmin && perms.canEdit("companies");
  const canDelete = !isSuperAdmin && perms.canDelete("companies");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [viewing, setViewing] = useState<Company | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: allCompanies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const rows = await apiFetch<Record<string, unknown>[]>(BASE);
      return rows.map(normalize);
    },
  });

  // Search is done client-side; move it to a query param if the API supports one.
  const companies = useMemo(() => {
    const list = [...(allCompanies ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.name, c.industry, c.city].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [allCompanies, search]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(companies.length / pageSize)));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const payload = toPayload(form);
      if (editing) {
        return apiFetch<Company>(`${BASE}/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Company>(BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Company updated" : "Company created");
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["companies-lite"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<unknown>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["companies-lite"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiUpload<ImportResult>(`${BASE}/import`, fd);
    },
    onSuccess: (r) => {
      if (r.failed > 0) {
        toast.warning(`Imported ${r.imported} of ${r.total_rows} rows (${r.failed} failed)`);
      } else {
        toast.success(`Imported ${r.imported} companies`);
      }
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["companies-lite"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: () => apiDownload(`${BASE}/export`, "companies.csv"),
    onSuccess: () => toast.success("Companies exported"),
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit form (only reachable with edit rights)
  const openEdit = (c: Company) => {
    if (!canEdit) return;
    setEditing(c);
    setForm({
      name: c.name, industry: c.industry ?? "", website: c.website ?? "",
      phone: c.phone ?? "", email: c.email ?? "",
      employee_count: c.employee_count ?? 0, annual_revenue: Number(c.annual_revenue ?? 0),
      city: c.city ?? "", country: c.country ?? "", notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">{allCompanies?.length ?? 0} accounts in your CRM.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv.mutate(file);
              e.target.value = "";
            }}
          />
          {canCreate && (
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
              {importCsv.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Import
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
            {exportCsv.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Export
          </Button>
          {canCreate && (<Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Company
          </Button>)}
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, industry, city..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Company</TableHead><TableHead>Industry</TableHead>
                <TableHead>Location</TableHead><TableHead>Employees</TableHead>
                <TableHead>Revenue</TableHead><TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>}
                {!isLoading && companies.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-16">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No companies yet.</p>
                  </TableCell></TableRow>
                )}
                {companies.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setViewing(c)}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.website && <div className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{c.website}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                    <TableCell className="text-sm">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell>{c.employee_count || "—"}</TableCell>
                    <TableCell>{formatRevenue(c.annual_revenue) ?? "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(c)}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                          {canEdit && <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                          {canDelete && <DropdownMenuItem className="text-destructive" onClick={() => del.mutate(c.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {companies.length > 0 && (() => {
            const total = companies.length;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));
            const curr = Math.min(page, pageCount);
            return (
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3" data-testid="companies-pagination">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-20 h-8" data-testid="companies-page-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 25, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span data-testid="companies-page-info">Page {curr} of {pageCount} · {total} total</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" data-testid="companies-prev" disabled={curr <= 1} onClick={() => setPage(curr - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" data-testid="companies-next" disabled={curr >= pageCount} onClick={() => setPage(curr + 1)}>Next</Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* View Company Dialog (read-only) */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{viewing.name}</DialogTitle>
                    <DialogDescription>
                      {[viewing.industry, [viewing.city, viewing.country].filter(Boolean).join(", ")]
                        .filter(Boolean)
                        .join(" · ") || "Company details"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
                <DetailRow label="Industry" value={viewing.industry} />
                <DetailRow label="Website" value={viewing.website} />
                <DetailRow label="Email" value={viewing.email} />
                <DetailRow label="Phone" value={viewing.phone} />
                <DetailRow label="City" value={viewing.city} />
                <DetailRow label="Country" value={viewing.country} />
                <DetailRow label="Employees" value={viewing.employee_count ? String(viewing.employee_count) : null} />
                <DetailRow label="Annual Revenue" value={formatRevenue(viewing.annual_revenue)} />
                <DetailRow
                  label="Created"
                  value={viewing.created_at
                    ? new Date(viewing.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : null}
                />
                <div className="col-span-2">
                  <DetailRow label="Notes" value={viewing.notes} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
                {canEdit && (
                  <Button onClick={() => { const c = viewing; setViewing(null); openEdit(c); }}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Company Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 min-w-0">
            <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({...form, website: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({...form, country: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Employees</Label><Input type="number" value={form.employee_count} onChange={(e) => setForm({...form, employee_count: Number(e.target.value)})} /></div>
            <div className="space-y-1.5"><Label>Annual Revenue ($)</Label><Input type="number" value={form.annual_revenue} onChange={(e) => setForm({...form, annual_revenue: Number(e.target.value)})} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm mt-1 wrap-break-word whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}