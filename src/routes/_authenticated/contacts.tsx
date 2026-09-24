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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Plus, Search, MoreVertical, Trash2, Pencil, Loader2, UserCircle, Mail, Phone, Upload, Download, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts — DigiCRM AI" }] }),
  component: ContactsPage,
});

const BASE = "/api/v1/contacts";

interface Contact {
  id: number;
  tenant_id?: number;
  first_name: string;
  last_name: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  company_id: number | null;
  notes: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
  owner_id?: number | null;
  tags?: string[];
  status?: string;
  created_at: string;
  updated_at?: string;
}

interface CompanyLite { id: number; name: string }

interface ImportResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: unknown[];
}

const empty = { first_name: "", last_name: "", email: "", phone: "", designation: "", linkedin_url: "", company_id: "", notes: "" };

// FastAPI/Pydantic rejects "" for typed fields like EmailStr, so send null instead.
const nullIfEmpty = (v: string) => (v.trim() === "" ? null : v.trim());

const contactName = (c: Contact) => `${c.first_name} ${c.last_name ?? ""}`.trim();

function ContactsPage() {
  const perms = usePermissions();
  const { hasRole, loading: authLoading } = useAuth();
  // super admins get read-only access here; also stay read-only until auth has loaded
  const isSuperAdmin = authLoading || hasRole("super_admin");
  const canCreate = !isSuperAdmin && perms.canCreate("contacts");
  const canEdit = !isSuperAdmin && perms.canEdit("contacts");
  const canDelete = !isSuperAdmin && perms.canDelete("contacts");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [viewing, setViewing] = useState<Contact | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: companies } = useQuery({
    queryKey: ["companies-lite"],
    queryFn: async () => {
      const rows = await apiFetch<CompanyLite[]>("/api/v1/companies");
      return rows
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: allContacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiFetch<Contact[]>(BASE),
  });

  // Search and company filter run client-side; move them to query params
  // if the API supports them and the list gets large.
  const contacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(allContacts ?? [])]
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .filter((c) => companyFilter === "all" || String(c.company_id) === companyFilter)
      .filter((c) =>
        !q || [c.first_name, c.last_name, c.email].some((v) => v?.toLowerCase().includes(q)),
      );
  }, [allContacts, search, companyFilter]);

  const companyName = (id: number | null | undefined) =>
    id != null ? companies?.find((c) => c.id === id)?.name ?? null : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim()) throw new Error("First name is required");
      const payload = {
        first_name: form.first_name.trim(),
        last_name: nullIfEmpty(form.last_name),
        email: nullIfEmpty(form.email),
        phone: nullIfEmpty(form.phone),
        designation: nullIfEmpty(form.designation),
        linkedin_url: nullIfEmpty(form.linkedin_url),
        company_id: form.company_id ? Number(form.company_id) : null,
        notes: nullIfEmpty(form.notes),
        // keep values the form doesn't edit so a PUT doesn't wipe them
        ...(editing ? { tags: editing.tags ?? [], status: editing.status } : {}),
      };
      if (editing) {
        return apiFetch<Contact>(`${BASE}/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return apiFetch<Contact>(BASE, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Contact updated" : "Contact created");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<unknown>(`${BASE}/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
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
        toast.success(`Imported ${r.imported} contacts`);
      }
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: () => apiDownload(`${BASE}/export`, "contacts.csv"),
    onSuccess: () => toast.success("Contacts exported"),
    onError: (e: Error) => toast.error(e.message),
  });

  // Edit form (only reachable with edit rights)
  const openEdit = (c: Contact) => {
    if (!canEdit) return;
    setEditing(c);
    setForm({
      first_name: c.first_name, last_name: c.last_name ?? "", email: c.email ?? "",
      phone: c.phone ?? "", designation: c.designation ?? "",
      linkedin_url: c.linkedin_url ?? "",
      company_id: c.company_id != null ? String(c.company_id) : "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">{allContacts?.length ?? 0} contacts across your network.</p>
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
            <Plus className="mr-2 h-4 w-4" /> New Contact
          </Button>)}
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {(companies ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden" data-testid="contacts-table-wrap">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Name</TableHead><TableHead>Designation</TableHead>
                <TableHead>Email</TableHead><TableHead>Phone</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>}
                {!isLoading && contacts.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-16">
                    <UserCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No contacts yet.</p>
                  </TableCell></TableRow>
                )}
                {contacts.slice((page - 1) * pageSize, page * pageSize).map(c => {
                  const name = contactName(c);
                  const initials = ((c.first_name?.[0] ?? "") + (c.last_name?.[0] ?? "")).toUpperCase();
                  return (
                    <TableRow key={c.id} data-testid="contact-row" data-contact-id={c.id} className="cursor-pointer" onClick={() => setViewing(c)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback></Avatar>
                          <span className="font-medium">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.designation || "—"}</TableCell>
                      <TableCell className="text-sm">{c.email ? <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</span> : "—"}</TableCell>
                      <TableCell className="text-sm">{c.phone ? <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</span> : "—"}</TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {contacts.length > 0 && (() => {
            const total = contacts.length;
            const pageCount = Math.max(1, Math.ceil(total / pageSize));
            const curr = Math.min(page, pageCount);
            return (
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3" data-testid="contacts-pagination">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-20 h-8" data-testid="contacts-page-size"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 25, 50].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span data-testid="contacts-page-info">Page {curr} of {pageCount} · {total} total</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" data-testid="contacts-prev" disabled={curr <= 1} onClick={() => setPage(curr - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" data-testid="contacts-next" disabled={curr >= pageCount} onClick={() => setPage(curr + 1)}>Next</Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* View Contact Dialog (read-only) */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {((viewing.first_name?.[0] ?? "") + (viewing.last_name?.[0] ?? "")).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="truncate">{contactName(viewing)}</DialogTitle>
                    <DialogDescription>
                      {[viewing.designation, companyName(viewing.company_id)].filter(Boolean).join(" · ") || "Contact details"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {viewing.status && (
                <div>
                  <Badge variant="outline" className="capitalize">{viewing.status}</Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
                <DetailRow label="Email" value={viewing.email} />
                <DetailRow label="Phone" value={viewing.phone} />
                <DetailRow label="Company" value={companyName(viewing.company_id)} />
                <DetailRow label="Designation" value={viewing.designation} />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">LinkedIn</div>
                  <div className="text-sm mt-1 wrap-break-word">
                    {viewing.linkedin_url ? (
                      <a
                        href={/^https?:\/\//i.test(viewing.linkedin_url) ? viewing.linkedin_url : `https://${viewing.linkedin_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {viewing.linkedin_url}
                      </a>
                    ) : "—"}
                  </div>
                </div>
                <DetailRow
                  label="Created"
                  value={viewing.created_at
                    ? new Date(viewing.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : null}
                />
                {viewing.tags && viewing.tags.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Tags</div>
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {viewing.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </div>
                  </div>
                )}
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

      {/* Create / Edit Contact Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2 min-w-0">
            <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Last Name</Label><Input value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({...form, designation: e.target.value})} /></div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={form.company_id || "none"} onValueChange={(v) => setForm({...form, company_id: v === "none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(companies ?? []).map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>LinkedIn</Label><Input type="url" placeholder="https://www.linkedin.com/in/username" value={form.linkedin_url} onChange={(e) => setForm({...form, linkedin_url: e.target.value})} /></div>
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