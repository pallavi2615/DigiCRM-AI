import { createFileRoute } from "@tanstack/react-router";
// import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
// NOTE: adjust this import path if your api.ts helper lives somewhere else.
import { apiFetch } from "@/lib/api";
// import { aiChat } from "@/lib/ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Sparkles, Loader2, Download, Plus, Pencil, Eye, Trash2, Search,
  Clock, ShieldCheck, LayoutTemplate, Save, Send, CheckCircle2, XCircle, ArrowRightLeft,
} from "lucide-react";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { ApprovalBadge } from "@/components/proposal-timeline";
import { convertProposalToDeal, proposalStageToDealStage, canConvert } from "@/lib/proposal-deal";
import type { ApprovalStatus, LeadStatus } from "@/lib/proposal-deal";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/datetime-picker";

const validateDate = (d: string) => {
  if (!d || d.trim() === "") {
    throw new Error("Date is required");
  }
  const date = new Date(d);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new Error(`Year must be between 1900 and 2100 (got: ${year})`);
  }
  return date.toISOString();
};

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "Proposals — DigiCRM AI" },
      { name: "description", content: "Create, track and edit sales proposals with amount, probability, status and terms." },
    ],
  }),
  component: ProposalsPage,
});

// Backend "status" is a free string; these are the values the send/accept/decline
// actions correspond to. Adjust if your backend uses different literals.
const STATUSES = ["draft", "sent", "negotiation", "accepted", "declined"] as const;
type Status = (typeof STATUSES)[number];

const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

const DEAL_STAGES: LeadStatus[] = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"];

interface Proposal {
  id: number;
  tenant_id: number;
  lead_id: number | null;
  title: string;
  description: string | null;
  amount: string; // backend returns this as a decimal-string
  currency: string;
  status: string;
  valid_until: string | null;
  terms: string | null;
  public_token: string | null;
  probability: number;
  close_date: string | null;
  owner: string | null;
  version: string | null;
  approval_status: ApprovalStatus | null;
  pipeline_stage: string | null;
  lead_name: string | null;
  template_id: number | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: number;
  tenant_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  priority: string | null;
  value: string | null;
  assigned_to: number | null;
  score: number | null;
  created_at: string;
  updated_at: string;
}

interface Template {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  category: string | null;
  owner_label: string | null;
  amount: string | null;
  currency: string | null;
  terms: string | null;
  content: Record<string, unknown> | null;
  shared_with_team: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  title: "",
  description: "",
  lead_id: "none",
  status: "draft" as Status,
  amount: "",
  currency: "INR",
  probability: "50",
  close_date: "",
  valid_until: "",
  terms: "",
  template_id: "none",
};
type Form = typeof emptyForm;

const statusTone: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/15 text-info",
  negotiation: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  declined: "bg-destructive/15 text-destructive",
};

function leadLabel(l: Lead) {
  return l.company || l.name || `Lead #${l.id}`;
}

function ProposalsPage() {
  const { user, isAdmin } = useAuth();
  const perms = usePermissions();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Proposal | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ title: "", category: "", is_shared: true });
  const [converting, setConverting] = useState<Proposal | null>(null);
  const [convertForm, setConvertForm] = useState({ stage: "proposal_sent" as LeadStatus, value: "" });

  // ---- Templates ---------------------------------------------------------
  const { data: templates } = useQuery({
    queryKey: ["proposal-templates"],
    queryFn: () => apiFetch<Template[]>("/api/v1/proposal-templates"),
  });

  const applyTemplate = (t: Template) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      title: t.title,
      description: t.description ?? "",
      amount: t.amount ? String(Number(t.amount)) : "",
      currency: t.currency || "INR",
      terms: t.terms ?? "",
      template_id: String(t.id),
    });
    setFormOpen(true);
    toast.success(`Template “${t.title}” loaded`);
  };

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!templateForm.title.trim()) throw new Error("Template name is required");
      await apiFetch("/api/v1/proposal-templates", {
        method: "POST",
        body: JSON.stringify({
          title: templateForm.title.trim(),
          description: form.description || null,
          category: templateForm.category || null,
          owner_label: null,
          amount: form.amount ? Number(form.amount) : 0,
          currency: form.currency || "INR",
          terms: form.terms || null,
          content: {},
          shared_with_team: templateForm.is_shared,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Saved as a reusable template");
      setTemplateOpen(false);
      setTemplateForm({ title: "", category: "", is_shared: true });
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: number) => {
      try {
        await apiFetch(`/api/v1/proposal-templates/${id}`, { method: "DELETE" });
      } catch (e) {
        // DELETE may return an empty body which can fail JSON parsing even on success.
        if (!(e instanceof SyntaxError)) throw e;
      }
    },
    onSuccess: () => {
      toast.success("Template removed");
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  // ---- Leads (for the picker) ---------------------------------------------
  const { data: leads } = useQuery({
    queryKey: ["proposal-leads"],
    queryFn: () => apiFetch<Lead[]>("/api/v1/leads"),
  });

  // "Related lead" dropdown: only qualified leads.
  // The currently-linked lead is always kept in the list so that editing an
  // existing proposal (whose lead may have moved to another stage after
  // "Convert to deal") still shows the selected lead.
  const relatedLeadOptions = useMemo(
    () =>
      (leads ?? []).filter(
        (l) =>
          (l.status ?? "").toLowerCase() === "qualified" ||
          String(l.id) === form.lead_id,
      ),
    [leads, form.lead_id],
  );

  // ---- Proposals -----------------------------------------------------------
  const { data: proposals, isLoading, isError, refetch } = useQuery({
    queryKey: ["proposals"],
    queryFn: () => apiFetch<Proposal[]>("/api/v1/proposals"),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (proposals ?? []).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!term) return true;
      return [p.title, p.description, p.terms].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [proposals, search, statusFilter]);

  const totals = useMemo(() => {
    const value = rows.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const weighted = rows.reduce((s, p) => s + (Number(p.amount ?? 0) * Number(p.probability ?? 0)) / 100, 0);
    const won = rows.filter((p) => p.status === "accepted").length;
    return { value, weighted, won };
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p: Proposal) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      lead_id: p.lead_id != null ? String(p.lead_id) : "none",
      status: (p.status as Status) ?? "draft",
      amount: String(p.amount ?? ""),
      currency: p.currency || "INR",
      probability: String(p.probability ?? 50),
      close_date: p.close_date ?? "",
      valid_until: p.valid_until ?? "",
      terms: p.terms ?? "",
      template_id: p.template_id != null ? String(p.template_id) : "none",
    });
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      if (form.close_date) validateDate(form.close_date);
      if (form.valid_until) validateDate(form.valid_until);

      const leadId = form.lead_id === "none" ? null : Number(form.lead_id);
      const selectedLead = (leads ?? []).find((l) => l.id === leadId) ?? null;

      const basePayload = {
        lead_id: leadId,
        title: form.title.trim(),
        description: form.description || null,
        amount: Number(form.amount || 0),
        currency: form.currency || "INR",
        valid_until: form.valid_until || null,
        terms: form.terms || null,
        probability: Math.min(100, Math.max(0, Number(form.probability || 0))),
        close_date: form.close_date || null,
        owner: selectedLead?.company || selectedLead?.name || "",
        version: editing?.version || "v1",
        pipeline_stage: editing?.pipeline_stage || "in_pipeline",
        lead_name: selectedLead ? leadLabel(selectedLead) : null,
        template_id: form.template_id === "none" ? null : Number(form.template_id),
      };

      if (editing) {
        await apiFetch(`/api/v1/proposals/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({
            ...basePayload,
            status: form.status,
            approval_status: editing.approval_status ?? "pending",
          }),
        });
      } else {
        await apiFetch("/api/v1/proposals", {
          method: "POST",
          body: JSON.stringify({
            ...basePayload,
            // POST schema has no "status" field — backend defaults new proposals (presumably "draft").
            approval_status: "pending",
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Proposal updated" : "Proposal created");
      qc.invalidateQueries({ queryKey: ["proposals"] });
      setFormOpen(false);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const openConvert = (p: Proposal) => {
    setConverting(p);
    setConvertForm({
      stage: proposalStageToDealStage[(p.status as keyof typeof proposalStageToDealStage)] ?? "proposal_sent",
      value: String(p.amount ?? 0),
    });
  };

  const convert = useMutation({
    mutationFn: async () => {
      if (!converting) throw new Error("Nothing to convert");
      const lead = (leads ?? []).find((l) => l.id === converting.lead_id);
      if (!lead) throw new Error("Linked lead not found");
      return convertProposalToDeal(converting, lead, {
        dealStage: convertForm.stage,
        value: Number(convertForm.value || 0),
      });
    },
    onSuccess: () => {
      toast.success("Deal updated in Pipeline");
      setConverting(null);
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["proposal-leads"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Add a title first so the AI knows what to draft");
      const selectedLead = (leads ?? []).find((l) => String(l.id) === form.lead_id);
      const prompt = `Draft a professional business proposal.

Title: ${form.title}
Client: ${selectedLead ? leadLabel(selectedLead) : "the client"}
Summary: ${form.description || "Not provided"}
Deal value: ${form.amount ? `${form.currency} ${form.amount}` : "TBD"}
Expected close: ${form.close_date || "TBD"}

Include: executive summary, scope of work, deliverables, timeline, pricing table and terms. Use clear markdown headings.`;
      const accessToken = localStorage.getItem("access_token");

      if (!accessToken) {
        throw new Error("Please login again");
      }

      const res = await apiFetch<{ content: string }>("/api/v1/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      setForm((f) => ({ ...f, terms: res.content }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Approval -------------------------------------------------------------
  const requestApproval = useMutation({
    mutationFn: async (p: Proposal) => {
      // No dedicated "request approval" endpoint — do a full update with approval_status: "pending".
      await apiFetch(`/api/v1/proposals/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({
          lead_id: p.lead_id,
          title: p.title,
          description: p.description,
          amount: Number(p.amount),
          currency: p.currency,
          valid_until: p.valid_until,
          terms: p.terms,
          status: p.status,
          probability: p.probability,
          close_date: p.close_date,
          owner: p.owner,
          version: p.version,
          approval_status: "pending",
          pipeline_stage: p.pipeline_stage,
          lead_name: p.lead_name,
          template_id: p.template_id,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Approval requested");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const approveProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Proposal approved");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const rejectProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/reject`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Proposal rejected");
      qc.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  // ---- Stage actions ----------------------------------------------------------
  const sendProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/send`, { method: "POST" }),
    onSuccess: () => { toast.success("Proposal marked as sent"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });
  const acceptProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/accept`, { method: "POST" }),
    onSuccess: () => { toast.success("Proposal marked as accepted"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });
  const declineProposal = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/v1/proposals/${id}/decline`, { method: "POST" }),
    onSuccess: () => { toast.success("Proposal marked as declined"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      try {
        await apiFetch(`/api/v1/proposals/${id}`, { method: "DELETE" });
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    },
    onSuccess: () => { toast.success("Proposal deleted"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const download = (p: Proposal) => {
    const body = p.terms || `# ${p.title}\n\n${p.description ?? ""}\n\nAmount: ${p.currency} ${Number(p.amount).toLocaleString()}\nStatus: ${p.status}`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposal-${p.title.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" /> Proposals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track every proposal with amount, probability, status and close date.
          </p>
        </div>
        {perms.canCreate("proposals") && (
          <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New proposal</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-card"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Open value</p>
          <p className="text-2xl font-bold">{totals.value.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Weighted forecast</p>
          <p className="text-2xl font-bold">{Math.round(totals.weighted).toLocaleString()}</p>
        </CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Accepted</p>
          <p className="text-2xl font-bold">{totals.won}</p>
        </CardContent></Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-primary" /> Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(templates ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No templates yet — open a proposal and choose “Save as template” to reuse it later.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {(templates ?? []).map((t) => (
              <div key={t.id} className="rounded border p-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {t.category ? `${t.category} · ` : ""}{t.description || "No description"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {t.shared_with_team ? "Shared with the team" : "Private"}
                    {t.amount ? ` · ${t.currency ?? ""} ${Number(t.amount).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {perms.canCreate("proposals") && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => applyTemplate(t)}>Use</Button>
                  )}
                  {(t.created_by != null && String(t.created_by) === user?.id || isAdmin) && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete template" onClick={() => deleteTemplate.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">All proposals</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-56" placeholder="Search proposals…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}

          {isError && (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-muted-foreground">We couldn't load your proposals.</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>Retry</Button>
            </div>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <div className="text-center py-14">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {(proposals ?? []).length === 0 ? "No proposals yet — create your first one." : "No proposals match these filters."}
              </p>
            </div>
          )}

          {rows.map((p) => (
            <div key={p.id} className="rounded border p-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{p.title}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] capitalize ${statusTone[p.status] ?? "bg-muted text-muted-foreground"}`}>{p.status}</span>
                  <ApprovalBadge status={p.approval_status} />
                  <span className="text-[10px] text-muted-foreground">{p.version ?? "v1"}</span>
                  {p.lead_id && <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]">Linked to lead</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description || "No description"}</p>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{p.currency} {Number(p.amount).toLocaleString()}</span>
                  <span>{p.probability}% likely</span>
                  <span>Close {p.close_date ? new Date(p.close_date).toLocaleDateString() : "—"}</span>
                  <span>Owner {p.owner || "Unassigned"}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {p.status === "draft" && perms.canEdit("proposals") && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => sendProposal.mutate(p.id)} disabled={sendProposal.isPending}>
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Send
                  </Button>
                )}
                {p.status === "sent" && perms.canEdit("proposals") && (
                  <>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => acceptProposal.mutate(p.id)} disabled={acceptProposal.isPending}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Accepted
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => declineProposal.mutate(p.id)} disabled={declineProposal.isPending}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Declined
                    </Button>
                  </>
                )}
                {perms.canEdit("proposals") && (p.approval_status ?? "pending") !== "pending" && !canConvert(p) && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => requestApproval.mutate(p)} disabled={requestApproval.isPending}>
                    <Clock className="mr-1.5 h-3.5 w-3.5" /> Request approval
                  </Button>
                )}
                {isAdmin && p.approval_status === "pending" && (
                  <>
                    <Button size="sm" className="h-8" onClick={() => approveProposal.mutate(p.id)} disabled={approveProposal.isPending}>
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => rejectProposal.mutate(p.id)} disabled={rejectProposal.isPending}>
                      Reject
                    </Button>
                  </>
                )}
                {perms.canEdit("proposals") && canConvert(p) && p.lead_id && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openConvert(p)}>
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    {p.pipeline_stage === "converted" ? "Update deal" : "Convert to deal"}
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setViewing(p)} title="View">
                  <Eye className="h-4 w-4" />
                </Button>
                {perms.canEdit("proposals") && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {perms.canDelete("proposals") && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => del.mutate(p.id)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit proposal" : "New proposal"}</DialogTitle>
            <DialogDescription>Link the proposal to a qualified lead and track its forecast.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5"><Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="CRM implementation for Acme" />
            </div>
            <div className="space-y-1.5"><Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="space-y-1.5"><Label>Template</Label>
              <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="No template" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">No template</SelectItem>
                  {(templates ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Related lead</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">None</SelectItem>
                    {relatedLeadOptions.length === 0 && (
                      <SelectItem value="__no_qualified__" disabled>
                        No qualified leads yet
                      </SelectItem>
                    )}
                    {relatedLeadOptions.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{leadLabel(l)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Only leads with status “Qualified” are listed.</p>
              </div>
              <div className="space-y-1.5"><Label>Owner</Label>
                <Input
                  disabled
                  value={
                    form.lead_id === "none"
                      ? "Unassigned"
                      : (() => {
                          const l = (leads ?? []).find((x) => String(x.id) === form.lead_id);
                          return l ? leadLabel(l) : "Unassigned";
                        })()
                  }
                />
                <p className="text-[11px] text-muted-foreground">Set automatically from the linked lead's company.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              {editing && (
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5"><Label>Amount</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Probability (%)</Label>
                <Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Close date</Label>
                <DatePicker
                  value={form.close_date}
                  onChange={(val) => setForm({ ...form, close_date: val })}
                  placeholder="Select close date"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valid until</Label>
                <DatePicker
                  value={form.valid_until}
                  onChange={(val) => setForm({ ...form, valid_until: val })}
                  placeholder="Select expiry date"
                />
              </div>
            </div>

            <Separator />
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Proposal document</p>
                <p className="text-xs text-muted-foreground">Draft the full document with AI, then edit it inline.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
                {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate with AI
              </Button>
            </div>
            <Textarea
              rows={8}
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              placeholder="Proposal content — generate with AI or write your own."
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setTemplateOpen(true)}>
              <Save className="mr-2 h-4 w-4" /> Save as template
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create proposal"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>Reuse this proposal's description, amount and terms as a starting point.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Template name *</Label>
              <Input value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} placeholder="Healthcare clinic onboarding" />
            </div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Input value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} placeholder="Healthcare" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={templateForm.is_shared} onChange={(e) => setTemplateForm({ ...templateForm, is_shared: e.target.checked })} />
              Share with the whole team
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending}>
              {saveTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
            <DialogDescription className="capitalize">{viewing?.status} · owner {viewing?.owner || "Unassigned"}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <ApprovalBadge status={viewing.approval_status} />
                <span className="text-xs text-muted-foreground">{viewing.version ?? "v1"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Amount</p><p className="font-medium">{viewing.currency} {Number(viewing.amount).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Probability</p><p className="font-medium">{viewing.probability}%</p></div>
                <div><p className="text-xs text-muted-foreground">Close date</p><p className="font-medium">{viewing.close_date ? new Date(viewing.close_date).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Valid until</p><p className="font-medium">{viewing.valid_until ? new Date(viewing.valid_until).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(viewing.created_at).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Sent</p><p className="font-medium">{viewing.sent_at ? new Date(viewing.sent_at).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Accepted</p><p className="font-medium">{viewing.accepted_at ? new Date(viewing.accepted_at).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Declined</p><p className="font-medium">{viewing.declined_at ? new Date(viewing.declined_at).toLocaleDateString() : "—"}</p></div>
              </div>
              {viewing.description && <div><p className="text-xs text-muted-foreground">Description</p><p>{viewing.description}</p></div>}
              {viewing.terms && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Document</p>
                  <div className="rounded border p-3 whitespace-pre-wrap max-h-80 overflow-y-auto text-xs">{viewing.terms}</div>
                </div>
              )}

              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Approval</p>
                <p className="text-xs">
                  {viewing.approval_status === "pending" && "Waiting on admin review."}
                  {viewing.approval_status === "approved" && "Approved."}
                  {viewing.approval_status === "rejected" && "Rejected."}
                  {!viewing.approval_status && "No approval requested yet."}
                </p>
                {!isAdmin && (
                  <p className="text-[11px] text-muted-foreground mt-2">Only Admins can approve or reject a proposal.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {viewing && <Button variant="outline" onClick={() => download(viewing)}><Download className="mr-2 h-4 w-4" /> Download</Button>}
            {viewing && perms.canEdit("proposals") && (
              <Button onClick={() => { const p = viewing; setViewing(null); openEdit(p); }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to deal */}
      <Dialog open={!!converting} onOpenChange={(o) => !o && setConverting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{converting?.pipeline_stage === "converted" ? "Update pipeline deal" : "Convert to pipeline deal"}</DialogTitle>
            <DialogDescription>
              Pushes this proposal's outcome onto its linked lead — updates the lead's pipeline stage and value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Pipeline stage</Label>
              <Select value={convertForm.stage} onValueChange={(v) => setConvertForm({ ...convertForm, stage: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Deal value</Label>
              <Input type="number" min={0} value={convertForm.value} onChange={(e) => setConvertForm({ ...convertForm, value: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConverting(null)}>Cancel</Button>
            <Button onClick={() => convert.mutate()} disabled={convert.isPending}>
              {convert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {converting?.pipeline_stage === "converted" ? "Update deal" : "Update lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}