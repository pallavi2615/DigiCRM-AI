import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Pencil, Download, Loader2, FileStack, Files } from "lucide-react";
import { downloadCsv, objectsToCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { escapePostgrestFilterValue } from "@/lib/utils";
import { useRealtimeTable } from "@/lib/use-realtime-table";

export const Route = createFileRoute("/_authenticated/fintech/applications")({
  component: ApplicationsPage,
});

const LOAN_TYPES = ["personal", "home", "business", "lap", "auto", "education", "gold"] as const;
const STAGES = ["new", "docs_pending", "docs_collected", "login", "under_review", "sanctioned", "disbursed", "rejected", "on_hold"] as const;
const EMPLOYMENTS = ["salaried", "self_employed", "business", "professional", "retired", "other"] as const;
const DOC_TYPES = ["pan", "aadhaar", "bank_stmt", "itr", "salary_slip", "form16", "photo", "address_proof", "property_papers", "other"] as const;

const stageColor: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  docs_pending: "bg-warning/15 text-warning",
  docs_collected: "bg-info/15 text-info",
  login: "bg-primary/15 text-primary",
  under_review: "bg-accent-foreground/15 text-accent-foreground",
  sanctioned: "bg-info/15 text-info",
  disbursed: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  on_hold: "bg-muted text-muted-foreground",
};

const emptyForm = {
  applicant_name: "", phone: "", email: "", pan: "", employment_type: "salaried",
  employer_name: "", monthly_income: 0, city: "",
  loan_type: "personal", requested_amount: 0, tenure_months: 36,
  lender_id: "", loan_product_id: "",
  stage: "new", sanctioned_amount: 0, disbursed_amount: 0, roi: 0, emi: 0,
  purpose: "", notes: "", source: "",
};

function ApplicationsPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [docDialog, setDocDialog] = useState<any>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["loan-apps", search, stageFilter],
    queryFn: async () => {
      let q = (supabase as any).from("loan_applications").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (stageFilter !== "all") q = q.eq("stage", stageFilter);
      if (search) q = q.or(`applicant_name.ilike.%${escapePostgrestFilterValue(search)}%,phone.ilike.%${escapePostgrestFilterValue(search)}%,email.ilike.%${escapePostgrestFilterValue(search)}%,pan.ilike.%${escapePostgrestFilterValue(search)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: lenders = [] } = useQuery({
    queryKey: ["lenders-select"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lenders").select("id, name, payout_pct").eq("active", true).order("name");
      return (data ?? []) as any[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-select", form.lender_id, form.loan_type],
    queryFn: async () => {
      if (!form.lender_id) return [];
      const { data } = await (supabase as any).from("loan_products").select("id, name, product_type, roi_min, roi_max").eq("lender_id", form.lender_id).eq("active", true);
      return (data ?? []) as any[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (!payload.lender_id) payload.lender_id = null;
      if (!payload.loan_product_id) payload.loan_product_id = null;
      ["monthly_income", "requested_amount", "sanctioned_amount", "disbursed_amount", "roi", "emi", "tenure_months"].forEach((k) => {
        payload[k] = payload[k] === "" || payload[k] == null ? null : Number(payload[k]);
      });
      if (editing) {
        const { error } = await (supabase as any).from("loan_applications").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await (supabase as any).from("loan_applications").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Application updated" : "Application created"); qc.invalidateQueries({ queryKey: ["loan-apps"] }); setOpen(false); setEditing(null); setForm(emptyForm); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("loan_applications").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["loan-apps"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  useRealtimeTable("loan_applications", [["loan-apps"], ["fintech-apps"], ["fintech-pipeline"]]);

  const openEdit = (row: any) => { setEditing(row); setForm({ ...emptyForm, ...row }); setOpen(true); };
  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const exportCsv = () => {
    const headers = ["applicant_name", "phone", "email", "pan", "loan_type", "requested_amount", "tenure_months", "stage", "sanctioned_amount", "disbursed_amount", "roi", "emi", "city", "source", "created_at"];
    const rows = apps.map((a: any) => Object.fromEntries(headers.map((h) => [h, a[h]])));
    downloadCsv(`loan-applications-${Date.now()}.csv`, objectsToCsv(rows as never, headers));
  };

  const inr = (n: any) => n ? "₹" + Number(n).toLocaleString("en-IN") : "—";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, phone, email, PAN…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Application</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Application" : "New Loan Application"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Applicant Name *"><Input value={form.applicant_name} onChange={(e) => setForm({ ...form, applicant_name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="PAN"><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} /></Field>
              <Field label="Employment">
                <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EMPLOYMENTS.map((e) => <SelectItem key={e} value={e}>{e.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Employer"><Input value={form.employer_name} onChange={(e) => setForm({ ...form, employer_name: e.target.value })} /></Field>
              <Field label="Monthly Income (₹)"><Input type="number" value={form.monthly_income} onChange={(e) => setForm({ ...form, monthly_income: e.target.value })} /></Field>
              <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Loan Type *">
                <Select value={form.loan_type} onValueChange={(v) => setForm({ ...form, loan_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Requested Amount (₹) *"><Input type="number" value={form.requested_amount} onChange={(e) => setForm({ ...form, requested_amount: e.target.value })} /></Field>
              <Field label="Tenure (months)"><Input type="number" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} /></Field>
              <Field label="Lender">
                <Select value={form.lender_id || undefined} onValueChange={(v) => setForm({ ...form, lender_id: v, loan_product_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select lender" /></SelectTrigger>
                  <SelectContent>{lenders.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Product">
                <Select value={form.loan_product_id || undefined} onValueChange={(v) => setForm({ ...form, loan_product_id: v })} disabled={!form.lender_id}>
                  <SelectTrigger><SelectValue placeholder={form.lender_id ? "Select product" : "Pick lender first"} /></SelectTrigger>
                  <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Stage">
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Sanctioned Amount (₹)"><Input type="number" value={form.sanctioned_amount} onChange={(e) => setForm({ ...form, sanctioned_amount: e.target.value })} /></Field>
              <Field label="Disbursed Amount (₹)"><Input type="number" value={form.disbursed_amount} onChange={(e) => setForm({ ...form, disbursed_amount: e.target.value })} /></Field>
              <Field label="ROI (%)"><Input type="number" step="0.01" value={form.roi} onChange={(e) => setForm({ ...form, roi: e.target.value })} /></Field>
              <Field label="EMI (₹)"><Input type="number" value={form.emi} onChange={(e) => setForm({ ...form, emi: e.target.value })} /></Field>
              <Field label="Source"><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Referral, Web, Walk-in…" /></Field>
              <div className="col-span-2"><Label className="text-xs">Purpose / Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.applicant_name || !form.requested_amount}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div> :
            apps.length === 0 ? <div className="p-12 text-center text-muted-foreground"><FileStack className="h-8 w-8 mx-auto mb-2 opacity-40" />No applications yet</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Applicant</TableHead><TableHead>Phone</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Stage</TableHead><TableHead>Disbursed</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {apps.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.applicant_name}<div className="text-xs text-muted-foreground">{a.pan || "—"}</div></TableCell>
                      <TableCell className="text-sm">{a.phone || "—"}</TableCell>
                      <TableCell className="text-sm capitalize">{a.loan_type}</TableCell>
                      <TableCell className="text-sm">{inr(a.requested_amount)}</TableCell>
                      <TableCell><Badge className={stageColor[a.stage]}>{a.stage.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-sm text-success">{inr(a.disbursed_amount)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(a)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDocDialog(a)}><Files className="h-4 w-4 mr-2" />KYC Documents</DropdownMenuItem>
                            {isAdmin && <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this application?")) del.mutate(a.id); }}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>

      <DocumentsDialog app={docDialog} onClose={() => setDocDialog(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function DocumentsDialog({ app, onClose }: { app: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const { data: docs = [] } = useQuery({
    queryKey: ["loan-docs", app?.id],
    enabled: !!app,
    queryFn: async () => {
      const { data } = await (supabase as any).from("loan_documents").select("*").eq("application_id", app.id);
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      const existing = docs.find((d: any) => d.doc_type === payload.doc_type);
      if (existing) {
        const { error } = await (supabase as any).from("loan_documents").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("loan_documents").insert({ ...payload, application_id: app.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loan-docs", app?.id] }),
  });

  const handleFile = async (docType: string, file: File) => {
    setUploading(docType);
    try {
      const path = `loan_applications/${app.id}/${docType}-${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (error) throw error;
      await upsert.mutateAsync({ doc_type: docType, storage_path: path, file_name: file.name, status: "uploaded" });
      toast.success(`${docType} uploaded`);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploading(null); }
  };

  const completeness = Math.round((docs.filter((d: any) => d.status === "uploaded" || d.status === "verified").length / DOC_TYPES.length) * 100);

  return (
    <Dialog open={!!app} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KYC Documents — {app?.applicant_name}</DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full gradient-primary transition-all" style={{ width: `${completeness}%` }} /></div>
            <span className="text-xs font-medium text-muted-foreground">{completeness}% complete</span>
          </div>
        </DialogHeader>
        <div className="space-y-2">
          {DOC_TYPES.map((dt) => {
            const doc = docs.find((d: any) => d.doc_type === dt);
            return (
              <div key={dt} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize">{dt.replace(/_/g, " ")}</div>
                  {doc?.file_name && <div className="text-xs text-muted-foreground truncate">{doc.file_name}</div>}
                </div>
                {doc && <Badge className={doc.status === "verified" ? "bg-success/15 text-success" : doc.status === "uploaded" ? "bg-info/15 text-info" : doc.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-muted"}>{doc.status}</Badge>}
                <label className="cursor-pointer">
                  <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(dt, e.target.files[0])} disabled={uploading === dt} />
                  <Button variant="outline" size="sm" asChild disabled={uploading === dt}>
                    <span>{uploading === dt ? <Loader2 className="h-3 w-3 animate-spin" /> : doc?.storage_path ? "Replace" : "Upload"}</span>
                  </Button>
                </label>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
