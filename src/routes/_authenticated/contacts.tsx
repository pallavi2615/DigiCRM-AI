import { usePermissions } from "@/hooks/use-permissions";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { useServerFn } from "@tanstack/react-start";
import { deleteRecord } from "@/lib/rbac.functions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Pencil, Loader2, UserCircle, Mail, Phone, Upload, Download } from "lucide-react";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { downloadCsv, objectsToCsv } from "@/lib/csv";

import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { escapePostgrestFilterValue } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({ meta: [{ title: "Contacts — DigiCRM AI" }] }),
  component: ContactsPage,
});

interface Contact {
  id: string; first_name: string; last_name: string | null;
  email: string | null; phone: string | null; designation: string | null;
  company_id: string | null; notes: string | null; created_at: string;
}

const empty = { first_name: "", last_name: "", email: "", phone: "", designation: "", company_id: "", notes: "" };

function ContactsPage() {
  const perms = usePermissions();
  const canCreate = perms.canCreate("contacts");
  const canEdit = perms.canEdit("contacts");
  const canDelete = perms.canDelete("contacts");
  const qc = useQueryClient();
  const deleteRecordFn = useServerFn(deleteRecord);
  useRealtimeTable("contacts", [["contacts"]]);
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(empty);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: companies } = useQuery({
    queryKey: ["companies-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").is("deleted_at", null).order("name");
      return data ?? [];
    },
  });

  const { group: crmGroup } = useActiveIndustry();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", search, companyFilter, crmGroup],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      q = scopeToIndustry(q, crmGroup);
      if (search) q = q.or(`first_name.ilike.%${escapePostgrestFilterValue(search)}%,last_name.ilike.%${escapePostgrestFilterValue(search)}%,email.ilike.%${escapePostgrestFilterValue(search)}%`);
      if (companyFilter !== "all") q = q.eq("company_id", companyFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name.trim()) throw new Error("First name is required");
      const payload = { ...form, company_id: form.company_id || null, created_by: user?.id, ...(editing ? {} : { industry_group: crmGroup }) };
      if (editing) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Contact updated" : "Contact created");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteRecordFn({ data: { module: "contacts", id } });
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      first_name: c.first_name, last_name: c.last_name ?? "", email: c.email ?? "",
      phone: c.phone ?? "", designation: c.designation ?? "", company_id: c.company_id ?? "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">{contacts?.length ?? 0} contacts across your network.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!contacts?.length) return toast.error("Nothing to export");
            const headers = ["first_name","last_name","email","phone","designation"];
            downloadCsv("contacts.csv", objectsToCsv(contacts as never, headers));
            toast.success(`Exported ${contacts.length} contacts`);
          }}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          {canCreate && (<Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Contact
          </Button>)}

        </div>
      </div>
      <CsvImportDialog entity="contacts" open={importOpen} onOpenChange={setImportOpen} />

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {(companies ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                {!isLoading && contacts?.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-16">
                    <UserCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No contacts yet.</p>
                  </TableCell></TableRow>
                )}
                {(contacts ?? []).slice((page - 1) * pageSize, page * pageSize).map(c => {
                  const name = `${c.first_name} ${c.last_name ?? ""}`.trim();
                  const initials = (c.first_name[0] + (c.last_name?.[0] ?? "")).toUpperCase();
                  return (
                    <TableRow key={c.id} data-testid="contact-row" data-contact-id={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
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
                            {canEdit && <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                            {canDelete && <DropdownMenuItem className="text-destructive" onClick={() => del.mutate(c.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>}
                          {!canEdit && !canDelete && <DropdownMenuItem disabled>View only</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {(contacts?.length ?? 0) > 0 && (() => {
            const total = contacts!.length;
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
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
                  {(companies ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
