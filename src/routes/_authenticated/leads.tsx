import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiFetch, apiUpload, apiDownload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Users, RefreshCw, Plus, Trash2, Upload, Download,
  MoreVertical, Link2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — DigiCRM AI" }] }),
  component: LeadsPage,
});

// ============ TYPES ============
interface Lead {
  id: number;
  tenant_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string;
  status: string;
  priority: string;
  value: number;
  assigned_to: number | null;
  score: number;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

type LeadsResponse = Lead[];

interface Tenant {
  id: number;
  name?: string;
  company_name?: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal_sent?: number;
  won: number;
  lost: number;
}

interface CreateLeadPayload {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: string;
  priority: string;
  value: number;
}

interface UpdateLeadPayload {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  status: string;
  priority: string;
  value: number;
}

interface ImportLeadsResult {
  total_rows: number;
  imported: number;
  failed: number;
  errors: string[];
}

const PAGE_SIZE = 20;

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-purple-100 text-purple-700",
  proposal_sent: "bg-indigo-100 text-indigo-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const emptyForm: CreateLeadPayload = {
  name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
  source: "manual",
  priority: "medium",
  value: 0,
};

function toUpdatePayload(lead: Lead): UpdateLeadPayload {
  return {
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    message: lead.message ?? "",
    status: lead.status ?? "new",
    priority: lead.priority ?? "medium",
    value: lead.value ?? 0,
  };
}

const tenantLabel = (t: Tenant) =>
  t.name ?? t.company_name ?? `Tenant #${t.id}`;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// ============ COMPONENT ============
function LeadsPage() {
  const qc = useQueryClient();

  const { hasRole, loading: authLoading } = useAuth();
  const isSuperadmin = hasRole("super_admin");
  const canWrite = !isSuperadmin;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [page, setPage] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateLeadPayload>(emptyForm);

  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<UpdateLeadPayload | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // -------- ⭐ Attach Follow-up State --------
  const [attachFor, setAttachFor] = useState<Lead | null>(null);
  const [attachSequenceId, setAttachSequenceId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportLeadsResult | null>(null);

  // -------- Leads List --------
  const {
    data: leads,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["leads", isSuperadmin, search, statusFilter, tenantFilter, page],
    enabled: !authLoading,
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (isSuperadmin && tenantFilter !== "all") {
        params.append("tenant_id", tenantFilter);
      }
      params.append("limit", String(PAGE_SIZE));
      params.append("offset", String(page * PAGE_SIZE));

      const base = isSuperadmin ? "/api/v1/superadmin/leads" : "/api/v1/leads";
      return apiFetch<LeadsResponse>(`${base}?${params.toString()}`);
    },
  });

  // -------- ⭐ Follow-up Sequences --------
  const { data: sequences } = useQuery({
    queryKey: ["followup-sequences"],
    queryFn: () => apiFetch<any[]>("/api/v1/followups/sequences"),
    enabled: !!attachFor,
  });

  // -------- Stats --------
  const { data: stats } = useQuery({
    queryKey: ["leads", "stats"],
    queryFn: () => apiFetch<LeadStats>("/api/v1/leads/stats"),
    enabled: !authLoading && !isSuperadmin,
  });

  // -------- Tenants --------
  const { data: tenants } = useQuery({
    queryKey: ["superadmin", "clients"],
    queryFn: async () => {
      const res = await apiFetch<Tenant[] | { items: Tenant[] }>(
        "/api/v1/superadmin/clients"
      );
      return Array.isArray(res) ? res : res.items ?? [];
    },
    enabled: isSuperadmin,
  });

  // -------- Create Lead --------
  const createLead = useMutation({
    mutationFn: (payload: CreateLeadPayload) =>
      apiFetch<Lead>("/api/v1/leads", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Lead created");
      setForm(emptyForm);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create lead");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() && !form.email.trim() && !form.phone.trim()) {
      toast.error("Add at least a name, email, or phone");
      return;
    }
    createLead.mutate(form);
  };

  // -------- Update Lead --------
  const updateLead = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateLeadPayload }) =>
      apiFetch<Lead>(`/api/v1/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Lead updated");
      setEditingLead(null);
      setEditForm(null);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update lead");
    },
  });

  // -------- Delete Lead --------
  const deleteLead = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ message: string }>(`/api/v1/leads/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Lead deleted");
      setDeleteConfirmOpen(false);
      setEditingLead(null);
      setEditForm(null);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete lead");
    },
  });

  // -------- Import Leads --------
  const importLeads = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<ImportLeadsResult>("/api/v1/leads/import", formData);
    },
    onSuccess: (result) => {
      setImportResult(result);
      setImportResultOpen(true);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to import leads");
    },
  });

  // -------- Export Leads --------
  const exportLeads = useMutation({
    mutationFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      const query = params.toString();
      const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      return apiDownload(`/api/v1/leads/export${query ? `?${query}` : ""}`, filename);
    },
    onSuccess: () => {
      toast.success("Export downloaded");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to export leads");
    },
  });

  // -------- ⭐ Attach Follow-up --------
  const attachSequence = useMutation({
    mutationFn: ({ leadId, sequenceId }: { leadId: number; sequenceId: number }) =>
      apiFetch<any>(`/api/v1/followups/leads/${leadId}/attach-sequence`, {
        method: "POST",
        body: JSON.stringify({ sequence_id: sequenceId }),
      }),
    onSuccess: (data: any) => {
      toast.success(`${data.tasks_created ?? 0} follow-up tasks created`);
      setAttachFor(null);
      setAttachSequenceId(null);
      qc.invalidateQueries({ queryKey: ["followup-tasks"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to attach sequence");
    },
  });

  const openEditDialog = (lead: Lead) => {
    if (!canWrite) return;
    setEditingLead(lead);
    setEditForm(toUpdatePayload(lead));
  };

  const closeEditDialog = () => {
    setEditingLead(null);
    setEditForm(null);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !editingLead || !editForm) return;
    updateLead.mutate({ id: editingLead.id, payload: editForm });
  };

  const handleDeleteConfirmed = () => {
    if (!canWrite || !editingLead) return;
    deleteLead.mutate(editingLead.id);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importLeads.mutate(file);
    e.target.value = "";
  };

  const items = leads ?? [];

  const filteredItems =
    priorityFilter === "all"
      ? items
      : items.filter((lead) => lead.priority === priorityFilter);

  const total = isSuperadmin ? items.length : stats?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  const colCount = isSuperadmin ? 9 : 8;   // ⭐ +1 for Actions column
  const showLoading = isLoading || authLoading;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    if (isSuperadmin) qc.invalidateQueries({ queryKey: ["superadmin"] });
    toast.success("Refreshed");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} leads · Track and convert your pipeline.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {canWrite && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                disabled={importLeads.isPending}
              >
                {importLeads.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportLeads.mutate()}
            disabled={exportLeads.isPending}
          >
            {exportLeads.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>

          {canWrite && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle>Create Lead</DialogTitle>
                    <DialogDescription>
                      Add a new lead manually to your pipeline.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="Jane Doe"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="jane@example.com"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={form.phone}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, phone: e.target.value }))
                          }
                          placeholder="9876543210"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="company">Company</Label>
                        <Input
                          id="company"
                          value={form.company}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, company: e.target.value }))
                          }
                          placeholder="Acme Inc."
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={form.message}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, message: e.target.value }))
                        }
                        placeholder="Interested in..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="source">Source</Label>
                        <Input
                          id="source"
                          value={form.source}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, source: e.target.value }))
                          }
                          placeholder="manual"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={form.priority}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, priority: v }))
                          }
                        >
                          <SelectTrigger id="priority">
                            <SelectValue placeholder="Priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="value">Value (₹)</Label>
                        <Input
                          id="value"
                          type="number"
                          min={0}
                          value={form.value}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              value: Number(e.target.value) || 0,
                            }))
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createLead.isPending}>
                      {createLead.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Lead
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && !isSuperadmin && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="New" value={stats.new} color="text-blue-600" />
          <StatCard label="Contacted" value={stats.contacted} color="text-yellow-600" />
          <StatCard label="Qualified" value={stats.qualified} color="text-purple-600" />
          <StatCard label="Won" value={stats.won} color="text-green-600" />
          <StatCard label="Lost" value={stats.lost} color="text-red-600" />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap mb-4">
            <Input
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="flex-1 min-w-64"
            />

            {isSuperadmin && (
              <Select
                value={tenantFilter}
                onValueChange={(v) => {
                  setTenantFilter(v);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tenants</SelectItem>
                  {tenants?.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {tenantLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter}
              onValueChange={(v) => setPriorityFilter(v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                  {isSuperadmin && <TableHead>Tenant</TableHead>}
                  <TableHead>Created</TableHead>
                  {canWrite && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {showLoading && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}

                {error && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-10">
                      <div className="text-red-600">
                        <p className="font-semibold">Error loading leads</p>
                        <p className="text-sm mt-1">{String(error)}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {!showLoading && !error && filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={colCount} className="text-center py-16">
                      <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No leads found.
                      </p>
                    </TableCell>
                  </TableRow>
                )}

                {!showLoading && !error && filteredItems.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className={`hover:bg-muted/30 ${canWrite ? "cursor-pointer" : ""}`}
                    onClick={canWrite ? () => openEditDialog(lead) : undefined}
                  >
                    <TableCell className="font-medium">
                      <div>{lead.name || "—"}</div>
                      {lead.company && (
                        <div className="text-xs text-muted-foreground">
                          {lead.company}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{lead.email || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.phone || ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${
                          statusColors[lead.status] ||
                          "bg-gray-100 text-gray-700"
                        } border-0 capitalize`}
                      >
                        {lead.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${
                          priorityColors[lead.priority] ||
                          "bg-gray-100 text-gray-700"
                        } border-0 capitalize`}
                      >
                        {lead.priority || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.value
                        ? currencyFormatter.format(lead.value)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {lead.source}
                    </TableCell>
                    {isSuperadmin && (
                      <TableCell className="text-muted-foreground text-sm">
                        {(() => {
                          const t = tenants?.find((t) => t.id === lead.tenant_id);
                          return t ? tenantLabel(t) : lead.tenant_id;
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(lead.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    {canWrite && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setAttachFor(lead)}>
                              <Link2 className="mr-2 h-4 w-4" />
                              Attach Follow-up
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Lead Dialog */}
      <Dialog
        open={!!editingLead}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {editingLead && editForm && (
            <form onSubmit={handleUpdateSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Lead</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => f && { ...f, name: e.target.value })
                    }
                    placeholder="Jane Doe"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => f && { ...f, email: e.target.value })
                    }
                    placeholder="jane@example.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => f && { ...f, phone: e.target.value })
                      }
                      placeholder="9876543210"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-company">Company</Label>
                    <Input
                      id="edit-company"
                      value={editForm.company}
                      onChange={(e) =>
                        setEditForm((f) => f && { ...f, company: e.target.value })
                      }
                      placeholder="Acme Inc."
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-message">Message</Label>
                  <Textarea
                    id="edit-message"
                    value={editForm.message}
                    onChange={(e) =>
                      setEditForm((f) => f && { ...f, message: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) =>
                        setEditForm((f) => f && { ...f, status: v })
                      }
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="proposal_sent">
                          Proposal Sent
                        </SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(v) =>
                        setEditForm((f) => f && { ...f, priority: v })
                      }
                    >
                      <SelectTrigger id="edit-priority">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-value">Value (₹)</Label>
                    <Input
                      id="edit-value"
                      type="number"
                      min={0}
                      value={editForm.value}
                      onChange={(e) =>
                        setEditForm(
                          (f) =>
                            f && { ...f, value: Number(e.target.value) || 0 }
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <AlertDialog
                  open={deleteConfirmOpen}
                  onOpenChange={setDeleteConfirmOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete{" "}
                        {editingLead.name || "this lead"}. This action cannot
                        be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteConfirmed}
                        disabled={deleteLead.isPending}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {deleteLead.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEditDialog}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateLead.isPending}>
                    {updateLead.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ⭐ Attach Follow-up Dialog */}
      <Dialog
        open={!!attachFor}
        onOpenChange={(open) => {
          if (!open) {
            setAttachFor(null);
            setAttachSequenceId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Follow-up Sequence</DialogTitle>
            <DialogDescription>
              Choose a sequence to attach to{" "}
              <strong>{attachFor?.name || "this lead"}</strong>. Tasks will be
              created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Sequence</Label>
              <Select
                value={attachSequenceId ? String(attachSequenceId) : ""}
                onValueChange={(v) => setAttachSequenceId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {(sequences ?? []).length === 0 && (
                    <SelectItem value="none" disabled>
                      No sequences yet
                    </SelectItem>
                  )}
                  {(sequences ?? []).map((seq: any) => (
                    <SelectItem key={seq.id} value={String(seq.id)}>
                      {seq.name} ({seq.total_steps} steps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAttachFor(null);
                setAttachSequenceId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!attachFor || !attachSequenceId) {
                  toast.error("Please select a sequence");
                  return;
                }
                attachSequence.mutate({
                  leadId: attachFor.id,
                  sequenceId: attachSequenceId,
                });
              }}
              disabled={attachSequence.isPending || !attachSequenceId}
            >
              {attachSequence.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Attach Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog open={importResultOpen} onOpenChange={setImportResultOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Complete</DialogTitle>
            <DialogDescription>
              Here's a summary of your CSV import.
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Total Rows
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {importResult.total_rows}
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Imported
                  </div>
                  <div className="text-xl font-bold mt-1 text-green-600">
                    {importResult.imported}
                  </div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Failed
                  </div>
                  <div className="text-xl font-bold mt-1 text-red-600">
                    {importResult.failed}
                  </div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="rounded-lg border p-3 max-h-48 overflow-y-auto">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Errors
                  </div>
                  <ul className="space-y-1 text-sm text-red-600 list-disc list-inside">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setImportResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ HELPER ============
function StatCard({
  label,
  value,
  color = "",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}