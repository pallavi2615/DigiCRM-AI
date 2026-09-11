import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KanbanSquare, Loader2, DollarSign, FileText, ArrowRightLeft, SlidersHorizontal, X } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { toast } from "sonner";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { convertProposalToDeal, proposalStageToDealStage, canConvert, type ProposalStage, type ApprovalStatus } from "@/lib/proposal-deal";
import { ApprovalBadge, ApprovalHistory, ProposalTimeline } from "@/components/proposal-timeline";

import { DatePicker } from "@/components/ui/datetime-picker";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — DigiCRM AI" }] }),
  component: PipelinePage,
});

type Status = "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
interface Deal {
  id: string; company_name: string; contact_person: string | null; status: Status;
  estimated_value: number | null; priority: string; email?: string | null; phone?: string | null;
  source?: string | null; expected_close_date?: string | null; notes?: string | null;
  industry?: string | null; updated_at?: string;
}

const stages: { key: Status; label: string; color: string; prob: number }[] = [
  { key: "new", label: "New", color: "border-t-muted-foreground", prob: 10 },
  { key: "contacted", label: "Contacted", color: "border-t-info", prob: 25 },
  { key: "qualified", label: "Qualified", color: "border-t-primary", prob: 40 },
  { key: "proposal_sent", label: "Proposal", color: "border-t-warning", prob: 60 },
  { key: "negotiation", label: "Negotiation", color: "border-t-accent-foreground", prob: 80 },
  { key: "won", label: "Won", color: "border-t-success", prob: 100 },
  { key: "lost", label: "Lost", color: "border-t-destructive", prob: 0 },
];

/** Urgent deals surface at the top of every stage column. */
const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

interface PipelineProposal {
  id: string; title: string; lead_id: string | null; contact_id: string | null; company_id: string | null;
  stage: ProposalStage; value: number; close_date: string | null; owner_id: string | null; notes: string | null;
  approval_status: ApprovalStatus | null;
}

function PipelinePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const perms = usePermissions();
  const canEdit = perms.canEdit("pipeline");
  const [detail, setDetail] = useState<Deal | null>(null);
  const [edit, setEdit] = useState({ status: "new" as Status, estimated_value: "", priority: "medium", expected_close_date: "", notes: "" });
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");


  const { data: proposals } = useQuery({
    queryKey: ["pipeline-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, title, lead_id, contact_id, company_id, stage, value, close_date, owner_id, notes, approval_status")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as PipelineProposal[];
    },
  });

  const convert = useMutation({
    mutationFn: async (p: PipelineProposal) => {
      if (!user?.id) throw new Error("Not signed in");
      return convertProposalToDeal(p, {
        dealStage: proposalStageToDealStage[p.stage],
        value: Number(p.value ?? 0),
        ownerId: p.owner_id ?? user.id,
        userId: user.id,
      });
    },
    onSuccess: () => {
      toast.success("Proposal added to the pipeline");
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      qc.invalidateQueries({ queryKey: ["pipeline-proposals"] });
      qc.invalidateQueries({ queryKey: ["kpi"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });



  const openDeal = (d: Deal) => {
    setDetail(d);
    setEdit({
      status: d.status,
      estimated_value: String(d.estimated_value ?? ""),
      priority: d.priority,
      expected_close_date: d.expected_close_date ?? "",
      notes: d.notes ?? "",
    });
  };

  const saveDeal = async () => {
  if (!detail) return;

  const { error } = await supabase
    .from("leads")
    .update({
      status: edit.status,
      estimated_value:
        edit.estimated_value === ""
          ? null
          : Number(edit.estimated_value),
      priority: edit.priority as "low" | "medium" | "high" | "urgent",
      expected_close_date: edit.expected_close_date || null,
      notes: edit.notes || null,
    })
    .eq("id", detail.id);

  if (error) return notifyPermissionDenied(error);

  toast.success("Deal updated");
  setDetail(null);

  qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
  qc.invalidateQueries({ queryKey: ["kpi"] });
};

  const { group: crmGroup } = useActiveIndustry();

  const { data: deals, isLoading } = useQuery({
    queryKey: ["pipeline-deals", crmGroup],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads")
        .select("id, company_name, contact_person, status, estimated_value, priority, email, phone, source, expected_close_date, notes, industry, updated_at")
        .is("deleted_at", null).order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Deal[];
    },
  });

  useRealtimeTable("leads", [["pipeline-deals"], ["kpi"], ["funnel"], ["sources"], ["monthly"]]);


  const handleDrop = async (status: Status) => {
    if (!dragId) return;
    const id = dragId; setDragId(null);
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Moved to ${status.replace("_"," ")}`);
    qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
    qc.invalidateQueries({ queryKey: ["kpi"] });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const companies = [...new Set((deals ?? []).map((d) => d.company_name).filter(Boolean))].sort();
  const activeFilters =
    (priorityFilter === "all" ? 0 : 1) + (stageFilter === "all" ? 0 : 1) + (companyFilter === "all" ? 0 : 1);
  const clearFilters = () => { setPriorityFilter("all"); setStageFilter("all"); setCompanyFilter("all"); };

  const visibleDeals = (deals ?? []).filter((d) =>
    (priorityFilter === "all" || d.priority === priorityFilter) &&
    (stageFilter === "all" || d.status === stageFilter) &&
    (companyFilter === "all" || d.company_name === companyFilter),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><KanbanSquare className="h-7 w-7 text-primary" /> Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Urgent deals first in every stage. Drag to update stages.</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filter
              {activeFilters > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{activeFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {["urgent", "high", "medium", "low"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stage</Label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">All companies</SelectItem>
                  {companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>Clear all</Button>
          </PopoverContent>
        </Popover>
      </div>

      {activeFilters > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {priorityFilter !== "all" && (
            <Badge variant="secondary" className="capitalize gap-1">
              Priority: {priorityFilter}
              <button onClick={() => setPriorityFilter("all")} aria-label="Clear priority filter"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {stageFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Stage: {stages.find((s) => s.key === stageFilter)?.label}
              <button onClick={() => setStageFilter("all")} aria-label="Clear stage filter"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {companyFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              Company: {companyFilter}
              <button onClick={() => setCompanyFilter("all")} aria-label="Clear company filter"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4 pb-4">
        <div className="flex gap-4 min-w-max">
          {stages.map(stage => {
            const items = visibleDeals
              .filter(d => d.status === stage.key)
              .sort((a, b) =>
                (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
                new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
              );
            const total = items.reduce((s, d) => s + Number(d.estimated_value ?? 0), 0);

            return (
              <div
                key={stage.key}
                className={`w-72 shrink-0 rounded-lg bg-muted/30 border-t-4 ${stage.color} p-3`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.key)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">{stage.label}</h3>
                    <p className="text-xs text-muted-foreground">{items.length} · ${total.toLocaleString()}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{stage.prob}%</Badge>
                </div>
                <div className="space-y-2 min-h-24">
                  {items.map(d => (
                    <Card
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openDeal(d)}
                      className={`p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${dragId === d.id ? "opacity-50" : ""}`}
                    >
                      <p className="font-medium text-sm truncate">{d.company_name}</p>
                      {d.contact_person && <p className="text-xs text-muted-foreground truncate">{d.contact_person}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />{Number(d.estimated_value ?? 0).toLocaleString()}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{d.priority}</Badge>
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Drop here</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Proposals</CardTitle>
          <Button asChild size="sm" variant="outline"><Link to="/proposals">Open proposals</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(proposals ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No proposals yet — draft one in the Proposals module or with the AI Assistant.
            </p>
          )}
          {(proposals ?? []).map((p) => (
            <div key={p.id} className="rounded border p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{p.title}</p>
                  <Badge variant="secondary" className="text-[10px] capitalize">{p.stage}</Badge>
                  {p.lead_id && <Badge variant="outline" className="text-[10px]">In pipeline</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ₹{Number(p.value ?? 0).toLocaleString()} · close {p.close_date ? new Date(p.close_date).toLocaleDateString() : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ApprovalBadge status={p.approval_status} />
              {canEdit && !p.lead_id && canConvert(p) && (
                <Button size="sm" variant="outline" onClick={() => convert.mutate(p)} disabled={convert.isPending}>
                  {convert.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />}
                  Convert to deal
                </Button>
              )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>


      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.company_name}</DialogTitle>
            <DialogDescription>
              {detail?.contact_person || "No contact person"}
              {detail?.industry ? ` · ${detail.industry}` : ""}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium truncate">{detail.email || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{detail.phone || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Source</p><p className="font-medium capitalize">{detail.source || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Last update</p><p className="font-medium">{detail.updated_at ? new Date(detail.updated_at).toLocaleDateString() : "—"}</p></div>
              </div>

              {canEdit ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Stage</Label>
                      <Select value={edit.status} onValueChange={(v) => setEdit({ ...edit, status: v as Status })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Priority</Label>
                      <Select value={edit.priority} onValueChange={(v) => setEdit({ ...edit, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["low","medium","high","urgent"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>Deal value</Label>
                      <Input type="number" min={0} value={edit.estimated_value} onChange={(e) => setEdit({ ...edit, estimated_value: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                          <Label>Expected close</Label>
                          <DatePicker
                            value={edit.expected_close_date}
                            onChange={(val) =>
                              setEdit((prev) => ({
                                ...prev,
                                expected_close_date: val,
                              }))
                            }
                            placeholder="Select Expected Close Date"
                          />
                        </div>
                  </div>
                  <div className="space-y-1.5"><Label>Notes</Label>
                    <Textarea rows={3} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Stage</p><p className="font-medium capitalize">{detail.status.replace("_", " ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Value</p><p className="font-medium">{Number(detail.estimated_value ?? 0).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Priority</p><p className="font-medium capitalize">{detail.priority}</p></div>
                  <div><p className="text-xs text-muted-foreground">Expected close</p><p className="font-medium">{detail.expected_close_date ?? "—"}</p></div>
                </div>
              )}
            </div>
          )}

          {detail && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Proposal timeline
              </p>
              <ProposalTimeline
                proposalIds={(proposals ?? []).filter((p) => p.lead_id === detail.id).map((p) => p.id)}
              />
              {(proposals ?? []).filter((p) => p.lead_id === detail.id).map((p) => (
                <div key={p.id} className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Approval history — {p.title}</p>
                  <ApprovalHistory proposalId={p.id} />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            {canEdit && <Button onClick={() => void saveDeal()}>Save changes</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
