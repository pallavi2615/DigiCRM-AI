import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { FileText, Sparkles, Loader2, Download, Plus, Pencil, Eye, Trash2, Search, ArrowRightLeft, Clock, ShieldCheck, History, LayoutTemplate, Save, RotateCcw } from "lucide-react";
import { aiChat } from "@/lib/ai.functions";
import { deleteRecord } from "@/lib/rbac.functions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { convertProposalToDeal, proposalStageToDealStage, canConvert, type LeadStatus, type ApprovalStatus } from "@/lib/proposal-deal";
import { ApprovalBadge, ApprovalHistory, ProposalTimeline } from "@/components/proposal-timeline";
import { useAllPacks } from "@/lib/pack-config";
import { useActiveTenant } from "@/lib/tenants";

import { toast } from "sonner";
import {DatePicker, DateTimePicker } from "@/components/ui/datetime-picker";
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


const DEAL_STAGES: LeadStatus[] = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"];


export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({
    meta: [
      { title: "Proposals — DigiCRM AI" },
      { name: "description", content: "Create, track and edit sales proposals with value, probability, stage and AI-drafted content." },
    ],
  }),
  component: ProposalsPage,
});

const STAGES = ["draft", "sent", "negotiation", "accepted", "rejected"] as const;
type Stage = (typeof STAGES)[number];

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  stage: Stage;
  value: number;
  probability: number;
  close_date: string | null;
  owner_id: string | null;
  notes: string | null;
  ai_content: string | null;
  created_at: string;
  approval_status: ApprovalStatus | null;
  approval_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  sent_at: string | null;
  reviewed_at: string | null;
  converted_at: string | null;
  version: number | null;
  group_slug?: string | null;
  pack_slug?: string | null;
}


interface Template {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  body: string;
  default_value: number | null;
  is_shared: boolean;
  created_by: string | null;
  group_slug: string | null;
  pack_slug: string | null;
}

interface Version {
  id: string;
  version: number;
  title: string;
  description: string | null;
  stage: string | null;
  value: number | null;
  ai_content: string | null;
  created_at: string;
}


const emptyForm = {
  title: "", description: "", lead_id: "none", contact_id: "none", company_id: "none",
  stage: "draft" as Stage, value: "", probability: "50", close_date: "", owner_id: "",
  notes: "", ai_content: "", pack: "none",
};
type Form = typeof emptyForm;


const stageTone: Record<Stage, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/15 text-info",
  negotiation: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};

function ProposalsPage() {
  const { user, isManager, isAdmin } = useAuth();
  const perms = usePermissions();
  const qc = useQueryClient();
  const chat = useServerFn(aiChat);
  const deleteRecordFn = useServerFn(deleteRecord);
  const { active: activeTenant } = useActiveTenant();
  const { packs } = useAllPacks();


  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState<Proposal | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [converting, setConverting] = useState<Proposal | null>(null);
  const [convertForm, setConvertForm] = useState({ stage: "proposal_sent" as LeadStatus, value: "", owner_id: "" });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: "", industry: "", is_shared: true });

  // ---- Templates -------------------------------------------------------
  const { data: templates } = useQuery({
    queryKey: ["proposal-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_templates")
        .select("id, name, description, industry, body, default_value, is_shared, created_by, group_slug, pack_slug")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const applyTemplate = (t: Template) => {
    setEditing(null);
    setForm({
      ...emptyForm,
      owner_id: user?.id ?? "",
      title: t.name,
      description: t.description ?? "",
      value: t.default_value ? String(t.default_value) : "",
      ai_content: t.body,
      pack: t.group_slug && t.pack_slug ? `${t.group_slug}::${t.pack_slug}` : "none",
    });
    setFormOpen(true);
    toast.success(`Template “${t.name}” loaded`);
  };


  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!templateForm.name.trim()) throw new Error("Template name is required");
      const [g, s] = form.pack === "none" ? [null, null] : (form.pack.split("::") as [string, string]);
      const { error } = await supabase.from("proposal_templates").insert({
        name: templateForm.name.trim(),
        description: form.description || null,
        industry: templateForm.industry || null,
        body: form.ai_content || "",
        default_value: form.value ? Number(form.value) : null,
        is_shared: templateForm.is_shared,
        created_by: user?.id ?? null,
        group_slug: g,
        pack_slug: s,
        tenant_id: activeTenant?.id ?? null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved as a reusable template");
      setTemplateOpen(false);
      setTemplateForm({ name: "", industry: "", is_shared: true });
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposal_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template removed");
      qc.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  // ---- Version history --------------------------------------------------
  const { data: versions } = useQuery({
    queryKey: ["proposal-versions", viewing?.id],
    enabled: !!viewing?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_versions")
        .select("id, version, title, description, stage, value, ai_content, created_at")
        .eq("proposal_id", viewing!.id)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Version[];
    },
  });

  const restoreVersion = useMutation({
    mutationFn: async (v: Version) => {
      if (!viewing) throw new Error("No proposal selected");
      const { error } = await supabase.from("proposals").update({
        title: v.title,
        description: v.description,
        value: Number(v.value ?? 0),
        ai_content: v.ai_content,
      }).eq("id", viewing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Version restored — the previous copy was kept in history");
      setViewing(null);
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["proposal-versions"] });
      qc.invalidateQueries({ queryKey: ["proposal-events"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  // ---- Approval ---------------------------------------------------------
  const approval = useMutation({
    mutationFn: async ({ p, status, notes }: { p: Proposal; status: ApprovalStatus; notes?: string }) => {
      const { error } = await supabase.from("proposals").update({
        approval_status: status,
        approval_notes: notes ?? p.approval_notes ?? null,
        ...(status === "pending"
          ? { approved_by: null, approved_at: null }
          : { approved_by: user?.id ?? null, approved_at: new Date().toISOString() }),
      }).eq("id", p.id);
      if (error) throw error;

      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.status === "pending" ? "Approval requested"
          : vars.status === "approved" ? "Proposal approved — ready to convert"
            : "Proposal approval rejected",
      );
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-proposals"] });
      qc.invalidateQueries({ queryKey: ["proposal-events"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });





  const { data: proposals, isLoading, isError, refetch } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Proposal[];
    },
  });

  // Related-record pickers (RLS scoped to what the user may read).
  const { data: related } = useQuery({
    queryKey: ["proposal-related"],
    queryFn: async () => {
      const [leads, contacts, companies] = await Promise.all([
        supabase.from("leads").select("id, company_name").is("deleted_at", null).order("company_name").limit(200),
        supabase.from("contacts").select("id, first_name, last_name").is("deleted_at", null).order("first_name").limit(200),
        supabase.from("companies").select("id, name").is("deleted_at", null).order("name").limit(200),
      ]);
      return {
        leads: leads.data ?? [],
        contacts: contacts.data ?? [],
        companies: companies.data ?? [],
      };
    },
  });

  const { data: owners } = useQuery({
    queryKey: ["proposal-owners"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      return data ?? [];
    },
  });

  const ownerName = (id: string | null) => {
    if (!id) return "Unassigned";
    const o = (owners ?? []).find((p) => p.id === id);
    return o?.full_name || o?.email || "Unknown";
  };

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (proposals ?? []).filter((p) => {
      if (stageFilter !== "all" && p.stage !== stageFilter) return false;
      if (!term) return true;
      return [p.title, p.description, p.notes].some((v) => (v ?? "").toLowerCase().includes(term));
    });
  }, [proposals, search, stageFilter]);

  const totals = useMemo(() => {
    const value = rows.reduce((s, p) => s + Number(p.value ?? 0), 0);
    const weighted = rows.reduce((s, p) => s + (Number(p.value ?? 0) * Number(p.probability ?? 0)) / 100, 0);
    const won = rows.filter((p) => p.stage === "accepted").length;
    return { value, weighted, won };
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, owner_id: user?.id ?? "" });
    setFormOpen(true);
  };

  const openEdit = (p: Proposal) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description ?? "",
      lead_id: p.lead_id ?? "none",
      contact_id: p.contact_id ?? "none",
      company_id: p.company_id ?? "none",
      stage: p.stage,
      value: String(p.value ?? ""),
      probability: String(p.probability ?? 50),
      close_date: p.close_date ?? "",
      owner_id: p.owner_id ?? "",
      notes: p.notes ?? "",
      ai_content: p.ai_content ?? "",
      pack: p.group_slug && p.pack_slug ? `${p.group_slug}::${p.pack_slug}` : "none",
    });
    setFormOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      const [packGroup, packSlug] = form.pack === "none" ? [null, null] : (form.pack.split("::") as [string, string]);
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        lead_id: form.lead_id === "none" ? null : form.lead_id,
        contact_id: form.contact_id === "none" ? null : form.contact_id,
        company_id: form.company_id === "none" ? null : form.company_id,
        stage: form.stage,
        value: Number(form.value || 0),
        probability: Math.min(100, Math.max(0, Number(form.probability || 0))),
        close_date: form.close_date || null,
        owner_id: form.owner_id || user?.id || null,
        notes: form.notes || null,
        ai_content: form.ai_content || null,
        group_slug: packGroup,
        pack_slug: packSlug,
      };
      if (editing) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("proposals")
          .insert({ ...payload, created_by: user?.id, tenant_id: activeTenant?.id ?? null });
        if (error) throw error;
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
      stage: proposalStageToDealStage[p.stage],
      value: String(p.value ?? 0),
      owner_id: p.owner_id ?? user?.id ?? "",
    });
  };

  const convert = useMutation({
    mutationFn: async () => {
      if (!converting || !user?.id) throw new Error("Nothing to convert");
      return convertProposalToDeal(converting, {
        dealStage: convertForm.stage,
        value: Number(convertForm.value || 0),
        ownerId: convertForm.owner_id || user.id,
        userId: user.id,
      });
    },
    onSuccess: (res) => {
      toast.success(res.created ? "Deal created in Pipeline" : "Linked deal updated in Pipeline");
      setConverting(null);
      qc.invalidateQueries({ queryKey: ["proposals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-proposals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });


  const del = useMutation({
    mutationFn: async (id: string) => { await deleteRecordFn({ data: { module: "proposals", id } }); },
    onSuccess: () => { toast.success("Proposal deleted"); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Add a title first so the AI knows what to draft");
      const leadName = related?.leads.find((l) => l.id === form.lead_id)?.company_name;
      const companyName = related?.companies.find((c) => c.id === form.company_id)?.name;
      const prompt = `Draft a professional business proposal.

Title: ${form.title}
Client: ${companyName || leadName || "the client"}
Summary: ${form.description || "Not provided"}
Deal value: ${form.value ? `₹${form.value}` : "TBD"}
Expected close: ${form.close_date || "TBD"}
Internal notes: ${form.notes || "None"}

Include: executive summary, scope of work, deliverables, timeline, pricing table and terms. Use clear markdown headings.`;
      const res = await chat({ data: { messages: [{ role: "user", content: prompt }] } });
      setForm((f) => ({ ...f, ai_content: res.content }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = (p: Proposal) => {
    const body = p.ai_content || `# ${p.title}\n\n${p.description ?? ""}\n\nValue: ${p.value}\nStage: ${p.stage}\n\n${p.notes ?? ""}`;
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
            Track every proposal with value, probability, owner and close date — and draft the document with AI.
          </p>
        </div>
        {perms.canCreate("proposals") && (
          <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New proposal</Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-card"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Open value</p>
          <p className="text-2xl font-bold">₹{totals.value.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="shadow-card"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Weighted forecast</p>
          <p className="text-2xl font-bold">₹{Math.round(totals.weighted).toLocaleString()}</p>
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
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {t.industry ? `${t.industry} · ` : ""}{t.description || "No description"}
                  </p>
                  {t.pack_slug && (
                    <p className="text-[10px] text-primary mt-0.5">
                      {packs.find((p) => p.group === t.group_slug && p.slug === t.pack_slug)?.name ?? t.pack_slug}
                    </p>
                  )}

                  <p className="text-[10px] text-muted-foreground mt-1">
                    {t.is_shared ? "Shared with the team" : "Private"}
                    {t.default_value ? ` · ₹${Number(t.default_value).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {perms.canCreate("proposals") && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => applyTemplate(t)}>Use</Button>
                  )}
                  {(t.created_by === user?.id || isManager) && (
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
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
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
                  <span className={`rounded px-1.5 py-0.5 text-[10px] capitalize ${stageTone[p.stage]}`}>{p.stage}</span>
                  <ApprovalBadge status={p.approval_status} />
                  <span className="text-[10px] text-muted-foreground">v{p.version ?? 1}</span>
                  {p.lead_id && <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]">In pipeline</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description || "No description"}</p>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>₹{Number(p.value).toLocaleString()}</span>
                  <span>{p.probability}% likely</span>
                  <span>Close {p.close_date ? new Date(p.close_date).toLocaleDateString() : "—"}</span>
                  <span>Owner {ownerName(p.owner_id)}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {perms.canEdit("proposals") && (p.approval_status ?? "not_requested") !== "pending" && !canConvert(p) && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => approval.mutate({ p, status: "pending" })} disabled={approval.isPending}>
                    <Clock className="mr-1.5 h-3.5 w-3.5" /> Request approval
                  </Button>
                )}
                {isAdmin && (p.approval_status ?? "not_requested") === "pending" && (
                  <>
                    <Button size="sm" className="h-8" onClick={() => approval.mutate({ p, status: "approved" })} disabled={approval.isPending}>
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => approval.mutate({ p, status: "rejected" })} disabled={approval.isPending}>
                      Reject
                    </Button>
                  </>
                )}
                {perms.canEdit("proposals") && canConvert(p) && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openConvert(p)}>
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    {p.lead_id ? "Update deal" : "Convert to deal"}
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
            <DialogDescription>Link the proposal to a lead, contact or company and track its forecast.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5"><Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="CRM implementation for Acme" />
            </div>
            <div className="space-y-1.5"><Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="space-y-1.5"><Label>Industry pack</Label>
              <Select value={form.pack} onValueChange={(v) => setForm({ ...form, pack: v })}>
                <SelectTrigger><SelectValue placeholder="No pack" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">No pack</SelectItem>
                  {packs.map((p) => (
                    <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>
                      {p.groupName} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Related lead</Label>
                <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>

                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(related?.leads ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(related?.contacts ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{[c.first_name, c.last_name].filter(Boolean).join(" ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Company</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(related?.companies ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Value (₹)</Label>
                <Input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Probability (%)</Label>
                <Input type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Close date</Label>
                <DatePicker
                  value={form.close_date}
                  onChange={(val) => setForm({ ...form, close_date: val })}
                  placeholder="Select close date"
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Owner</Label>
              <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {(owners ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5"><Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
              value={form.ai_content}
              onChange={(e) => setForm({ ...form, ai_content: e.target.value })}
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
            <DialogDescription>Reuse this proposal's description, value and document as a starting point.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Template name *</Label>
              <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Healthcare clinic onboarding" />
            </div>
            <div className="space-y-1.5"><Label>Industry</Label>
              <Input value={templateForm.industry} onChange={(e) => setTemplateForm({ ...templateForm, industry: e.target.value })} placeholder="Healthcare" />
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
            <DialogDescription className="capitalize">{viewing?.stage} · owner {ownerName(viewing?.owner_id ?? null)}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <ApprovalBadge status={viewing.approval_status} />
                <span className="text-xs text-muted-foreground">Version {viewing.version ?? 1}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Value</p><p className="font-medium">₹{Number(viewing.value).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Probability</p><p className="font-medium">{viewing.probability}%</p></div>
                <div><p className="text-xs text-muted-foreground">Close date</p><p className="font-medium">{viewing.close_date ? new Date(viewing.close_date).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Created</p><p className="font-medium">{new Date(viewing.created_at).toLocaleDateString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Sent</p><p className="font-medium">{viewing.sent_at ? new Date(viewing.sent_at).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Converted</p><p className="font-medium">{viewing.converted_at ? new Date(viewing.converted_at).toLocaleDateString() : "—"}</p></div>
              </div>
              {viewing.description && <div><p className="text-xs text-muted-foreground">Description</p><p>{viewing.description}</p></div>}
              {viewing.notes && <div><p className="text-xs text-muted-foreground">Notes</p><p>{viewing.notes}</p></div>}
              {viewing.ai_content && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Document</p>
                  <div className="rounded border p-3 whitespace-pre-wrap max-h-80 overflow-y-auto text-xs">{viewing.ai_content}</div>
                </div>
              )}

              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Timeline</p>
                <ProposalTimeline proposalIds={[viewing.id]} />
              </div>

              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Approval history</p>
                <ApprovalHistory proposalId={viewing.id} />
                {!isAdmin && (
                  <p className="text-[11px] text-muted-foreground mt-2">Only Admins and Super Admins can approve or reject a proposal.</p>
                )}
              </div>

              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><History className="h-3.5 w-3.5" /> Version history</p>
                {(versions ?? []).length === 0 && <p className="text-xs text-muted-foreground">No earlier versions yet.</p>}
                <div className="space-y-2">
                  {(versions ?? []).map((v) => (
                    <div key={v.id} className="rounded border p-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium truncate">v{v.version} · {v.title}</p>
                        <p className="text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()} · ₹{Number(v.value ?? 0).toLocaleString()} · {v.stage}
                        </p>
                      </div>
                      {perms.canEdit("proposals") && (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => restoreVersion.mutate(v)} disabled={restoreVersion.isPending}>
                          <RotateCcw className="mr-1.5 h-3 w-3" /> Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
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
            <DialogTitle>{converting?.lead_id ? "Update pipeline deal" : "Convert to pipeline deal"}</DialogTitle>
            <DialogDescription>
              {converting?.lead_id
                ? "This proposal is already linked to a deal — update its stage, value and owner."
                : "Creates a deal in the Pipeline from this proposal's lead, company and owner."}
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
            <div className="space-y-1.5"><Label>Deal value (₹)</Label>
              <Input type="number" min={0} value={convertForm.value} onChange={(e) => setConvertForm({ ...convertForm, value: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Owner</Label>
              <Select value={convertForm.owner_id} onValueChange={(v) => setConvertForm({ ...convertForm, owner_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>
                  {(owners ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || o.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConverting(null)}>Cancel</Button>
            <Button onClick={() => convert.mutate()} disabled={convert.isPending}>
              {convert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {converting?.lead_id ? "Update deal" : "Create deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
