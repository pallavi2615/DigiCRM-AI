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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Pencil, Loader2, Building2, Globe, Upload, Download } from "lucide-react";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { downloadCsv, objectsToCsv } from "@/lib/csv";

import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { escapePostgrestFilterValue } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/companies")({
  head: () => ({ meta: [{ title: "Companies — DigiCRM AI" }] }),
  component: CompaniesPage,
});

interface Company {
  id: string; name: string; industry: string | null; website: string | null;
  phone: string | null; email: string | null; employee_count: number | null;
  annual_revenue: number | null; city: string | null; country: string | null;
  notes: string | null; created_at: string;
}

const empty = {
  name: "", industry: "", website: "", phone: "", email: "",
  employee_count: 0, annual_revenue: 0, city: "", country: "", notes: "",
};

function CompaniesPage() {
  const perms = usePermissions();
  const canCreate = perms.canCreate("companies");
  const canEdit = perms.canEdit("companies");
  const canDelete = perms.canDelete("companies");
  const qc = useQueryClient();
  const deleteRecordFn = useServerFn(deleteRecord);
  useRealtimeTable("companies", [["companies"], ["companies-lite"]]);
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(empty);

  const { group: crmGroup } = useActiveIndustry();

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies", search, crmGroup],
    queryFn: async () => {
      let q = supabase.from("companies").select("*").is("deleted_at", null).order("name");
      q = scopeToIndustry(q, crmGroup);
      if (search) q = q.or(`name.ilike.%${escapePostgrestFilterValue(search)}%,industry.ilike.%${escapePostgrestFilterValue(search)}%,city.ilike.%${escapePostgrestFilterValue(search)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      const payload = {
        ...form,
        employee_count: Number(form.employee_count) || null,
        annual_revenue: Number(form.annual_revenue) || null,
        created_by: user?.id,
        ...(editing ? {} : { industry_group: crmGroup }),
      };
      if (editing) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(payload);
        if (error) throw error;
      }
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
    mutationFn: async (id: string) => {
      await deleteRecordFn({ data: { module: "companies", id } });
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["companies"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openEdit = (c: Company) => {
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
          <p className="text-muted-foreground text-sm mt-1">{companies?.length ?? 0} accounts in your CRM.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (!companies?.length) return toast.error("Nothing to export");
            const headers = ["name","industry","website","phone","email","employee_count","annual_revenue","city","country"];
            downloadCsv("companies.csv", objectsToCsv(companies as never, headers));
            toast.success(`Exported ${companies.length} companies`);
          }}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          {canCreate && (<Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New Company
          </Button>)}

        </div>
      </div>
      <CsvImportDialog entity="companies" open={importOpen} onOpenChange={setImportOpen} />

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, industry, city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                {!isLoading && companies?.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-16">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No companies yet.</p>
                  </TableCell></TableRow>
                )}
                {companies?.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      {c.website && <div className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" />{c.website}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.industry || "—"}</TableCell>
                    <TableCell className="text-sm">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell>{c.employee_count || "—"}</TableCell>
                    <TableCell>{c.annual_revenue ? `$${Number(c.annual_revenue).toLocaleString()}` : "—"}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
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
