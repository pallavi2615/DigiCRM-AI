import { usePermissions } from "@/hooks/use-permissions";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { useServerFn } from "@tanstack/react-start";
import { useSearch } from "@tanstack/react-router";
import { deleteRecord } from "@/lib/rbac.functions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Pencil, Download, Upload, Loader2, Users } from "lucide-react";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { downloadCsv, objectsToCsv } from "@/lib/csv";

import { toast } from "sonner";
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

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — DigiCRM AI" }] }),
  component: LeadsPage,
});

type LeadStatus = "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
type LeadPriority = "low" | "medium" | "high" | "urgent";

interface Lead {
  id: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  source: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  estimated_value: number | null;
  expected_close_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

const statusColors: Record<LeadStatus, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-info/15 text-info",
  qualified: "bg-primary/15 text-primary",
  proposal_sent: "bg-warning/15 text-warning",
  negotiation: "bg-accent-foreground/15 text-accent-foreground",
  won: "bg-success/15 text-success",
  lost: "bg-destructive/15 text-destructive",
};

const priorityColors: Record<LeadPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

const emptyForm = {
  company_name: "", contact_person: "", designation: "", email: "", phone: "",
  website: "", industry: "", country: "", city: "", source: "",
  status: "new" as LeadStatus, priority: "medium" as LeadPriority,
  estimated_value: 0, expected_close_date: "", notes: "",
};

function LeadsPage() {
  const urlSearch = useSearch({ from: "/_authenticated/leads" });

const statusFromUrl = (urlSearch as { status?: string }).status;

const industryGroupFromUrl = (
  urlSearch as { industry_group?: string }
).industry_group;
  const perms = usePermissions();
  const canCreate = perms.canCreate("leads");
  const canEdit = perms.canEdit("leads");
  const canDelete = perms.canDelete("leads");
  const qc = useQueryClient();
  const deleteRecordFn = useServerFn(deleteRecord);
  useRealtimeTable("leads", [["leads"], ["kpi"], ["pipeline-deals"]]);
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(statusFromUrl ?? "all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const pageSize = 15;
  const { group: crmGroup } = useActiveIndustry();

  useEffect(() => {
    if (statusFromUrl && statusFromUrl !== statusFilter) {
      setStatusFilter(statusFromUrl);
      setPage(0);
    }
  }, [statusFromUrl]);

  const { data: leads, isLoading } = useQuery({
  queryKey: [
    "leads",
    search,
    statusFilter,
    priorityFilter,
    page,
    industryGroupFromUrl ?? "all",
  ],

  queryFn: async () => {
    let q = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(
        page * pageSize,
        page * pageSize + pageSize - 1
      );

    // Apply CRM filter only when a CRM was selected
    if (industryGroupFromUrl) {
      q = q.eq("industry_group", industryGroupFromUrl);
    }

    if (search) {
      q = q.or(
        `company_name.ilike.%${escapePostgrestFilterValue(search)}%,contact_person.ilike.%${escapePostgrestFilterValue(search)}%,email.ilike.%${escapePostgrestFilterValue(search)}%`
      );
    }

    if (statusFilter !== "all") {
      q = q.eq("status", statusFilter as LeadStatus);
    }

    if (priorityFilter !== "all") {
      q = q.eq("priority", priorityFilter as LeadPriority);
    }

    const { data, count, error } = await q;

    if (error) throw error;

    return {
      rows: (data ?? []) as Lead[],
      count: count ?? 0,
    };
  },
});

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.company_name.trim()) throw new Error("Company name is required");
      const payload = {
        ...form,
        estimated_value: Number(form.estimated_value) || 0,
        expected_close_date: form.expected_close_date || null,
        created_by: user?.id,
        ...(editing ? {} : { industry_group: crmGroup }),
      };
      if (editing) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        // Dup check
        if (form.email) {
          const { data: dup } = await supabase.from("leads").select("id").eq("email", form.email).is("deleted_at", null).limit(1);
          if (dup && dup.length > 0) throw new Error("A lead with this email already exists");
        }
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Lead updated" : "Lead created");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
      setDialogOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteRecordFn({ data: { module: "leads", id } });
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      ...emptyForm,
      company_name: l.company_name, contact_person: l.contact_person ?? "",
      email: l.email ?? "", phone: l.phone ?? "", industry: l.industry ?? "",
      source: l.source ?? "", status: l.status, priority: l.priority,
      estimated_value: Number(l.estimated_value ?? 0),
      expected_close_date: l.expected_close_date ?? "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const exportCsv = () => {
    if (!leads?.rows.length) return toast.error("Nothing to export");
    const headers = ["company_name","contact_person","email","phone","industry","source","status","priority","estimated_value","expected_close_date"];
    const rows = leads.rows.map(l => ({
      company_name: l.company_name, contact_person: l.contact_person ?? "", email: l.email ?? "",
      phone: l.phone ?? "", industry: l.industry ?? "", source: l.source ?? "",
      status: l.status, priority: l.priority, estimated_value: l.estimated_value ?? 0,
      expected_close_date: l.expected_close_date ?? "",
    }));
    downloadCsv("leads.csv", objectsToCsv(rows as never, headers));
    toast.success(`Exported ${rows.length} leads`);
  };


  const totalPages = Math.ceil((leads?.count ?? 0) / pageSize);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold capitalize">
            {statusFilter !== "all" 
              ? `${statusFilter.replace("_", " ")} Leads` 
              : "Leads"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {leads?.count ?? 0} leads · Track and convert your pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          {canCreate && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> New Lead
            </Button>
          )}
        </div>
      </div>
      <CsvImportDialog entity="leads" open={importOpen} onOpenChange={setImportOpen} />

      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search company, contact, email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(["new","contacted","qualified","proposal_sent","negotiation","won","lost"] as LeadStatus[]).map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {(["low","medium","high","urgent"] as LeadPriority[]).map(p => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell></TableRow>
                )}
                {!isLoading && leads?.rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-16">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No leads yet. Create your first one.</p>
                  </TableCell></TableRow>
                )}
                {leads?.rows.map(l => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => openEdit(l)}>
                    <TableCell className="font-medium">{l.company_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{l.contact_person || "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.email}</div>
                    </TableCell>
                    <TableCell><Badge className={`${statusColors[l.status]} border-0 capitalize`}>{l.status.replace("_"," ")}</Badge></TableCell>
                    <TableCell><Badge className={`${priorityColors[l.priority]} border-0 capitalize`}>{l.priority}</Badge></TableCell>
                    <TableCell className="font-medium">${Number(l.estimated_value ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{l.source || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && <DropdownMenuItem onClick={() => openEdit(l)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>}
                          {!canEdit && !canDelete && <DropdownMenuItem disabled>View only</DropdownMenuItem>}
                          {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                                <AlertDialogDescription>This will soft-delete "{l.company_name}". You can restore it later.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(l.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lead" : "Create new lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({...form, company_name: e.target.value})} required />
            </div>
            <div className="space-y-1.5"><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({...form, contact_person: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({...form, designation: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({...form, website: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Industry</Label><Input value={form.industry} onChange={(e) => setForm({...form, industry: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({...form, country: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Source</Label><Input placeholder="Website, Referral, LinkedIn..." value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({...form, status: v as LeadStatus})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["new","contacted","qualified","proposal_sent","negotiation","won","lost"] as LeadStatus[]).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v as LeadPriority})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["low","medium","high","urgent"] as LeadPriority[]).map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Estimated Value ($)</Label><Input type="number" value={form.estimated_value} onChange={(e) => setForm({...form, estimated_value: Number(e.target.value)})} /></div>
            <div className="space-y-1.5"><Label>Expected Close Date</Label><DatePicker  value={form.expected_close_date} onChange={(val) => setForm({ ...form, expected_close_date: val })}placeholder="Select close date" /></div>            
          <div className="col-span-2 space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
