import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Upload, FileText, X, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { escapePostgrestFilterValue } from "@/lib/utils";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { downloadCsv, objectsToCsv } from "@/lib/csv";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/realestate/clients")({
  component: RealEstateClientsPage,
});

const KYC = ["pending", "verified", "rejected"];

function RealEstateClientsPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>({ full_name: "", phone: "", email: "", budget_min: "", budget_max: "", preferred_city: "", preferred_type: "", requirement: "", kyc_status: "pending" });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["re-clients", q],
    queryFn: async () => {
      let query = (supabase as any).from("re_clients").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`full_name.ilike.%${escapePostgrestFilterValue(q)}%,phone.ilike.%${escapePostgrestFilterValue(q)}%,email.ilike.%${escapePostgrestFilterValue(q)}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    const payload = {
      ...form,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      owner_id: edit?.owner_id ?? user?.id,
      agent_id: edit?.agent_id ?? user?.id,
    };
    const { error } = edit
      ? await (supabase as any).from("re_clients").update(payload).eq("id", edit.id)
      : await (supabase as any).from("re_clients").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(edit ? "Client updated" : "Client added");
    setOpen(false); setEdit(null);
    setForm({ full_name: "", phone: "", email: "", budget_min: "", budget_max: "", preferred_city: "", preferred_type: "", requirement: "", kyc_status: "pending" });
    qc.invalidateQueries({ queryKey: ["re-clients"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this client?")) return;
    const { error } = await (supabase as any).from("re_clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["re-clients"] });
  };

  const openEdit = (row: any) => {
    setEdit(row);
    setForm({ ...row, budget_min: row.budget_min ?? "", budget_max: row.budget_max ?? "" });
    setOpen(true);
  };

  useRealtimeTable("re_clients", [["re-clients"], ["re-clients-kpi"]]);

  const exportCsv = () => {
    const headers = ["full_name", "phone", "email", "budget_min", "budget_max", "preferred_city", "preferred_type", "kyc_status", "requirement", "created_at"];
    const out = rows.map((r: any) => Object.fromEntries(headers.map((h) => [h, r[h]])));
    downloadCsv(`re-clients-${Date.now()}.csv`, objectsToCsv(out as never, headers));
  };

  const kycColor = (s: string) => s === "verified" ? "bg-success/15 text-success" : s === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Clients & Buyers</h2>
          <p className="text-sm text-muted-foreground">Manage buyers, requirements and KYC documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name/phone/email" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Client</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Budget</TableHead>
              <TableHead>Preferences</TableHead><TableHead>KYC</TableHead><TableHead>Owner</TableHead><TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No clients yet. Add your first buyer.</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.full_name}</TableCell>
                <TableCell className="text-xs">{r.phone}<br/><span className="text-muted-foreground">{r.email}</span></TableCell>
                <TableCell className="text-xs">{r.budget_min ? `₹${(r.budget_min/100000).toFixed(1)}L` : "—"} – {r.budget_max ? `₹${(r.budget_max/100000).toFixed(1)}L` : "—"}</TableCell>
                <TableCell className="text-xs">{r.preferred_city || "—"} · {r.preferred_type || "any"}</TableCell>
                <TableCell><Badge variant="secondary" className={kycColor(r.kyc_status)}>{r.kyc_status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.owner_id === user?.id ? "You" : "Team"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setKycOpen(r.id)} title="KYC"><ShieldCheck className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit Client" : "New Client"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <Input placeholder="Full name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Select value={form.kyc_status} onValueChange={(v) => setForm({ ...form, kyc_status: v })}>
              <SelectTrigger><SelectValue placeholder="KYC status" /></SelectTrigger>
              <SelectContent>{KYC.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Budget min (₹)" type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
            <Input placeholder="Budget max (₹)" type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
            <Input placeholder="Preferred city" value={form.preferred_city} onChange={(e) => setForm({ ...form, preferred_city: e.target.value })} />
            <Input placeholder="Preferred type (1BHK, villa...)" value={form.preferred_type} onChange={(e) => setForm({ ...form, preferred_type: e.target.value })} />
            <Textarea className="md:col-span-2" placeholder="Requirements / notes" value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.full_name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KycDialog id={kycOpen} onClose={() => setKycOpen(null)} />
    </div>
  );
}

function KycDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: client } = useQuery({
    queryKey: ["re-client", id],
    enabled: !!id,
    queryFn: async () => (await (supabase as any).from("re_clients").select("*").eq("id", id).single()).data,
  });
  const docs: any[] = client?.kyc_documents || [];

  const upload = async (file: File) => {
    if (!id) return;
    const path = `re_clients/${id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const next = [...docs, { name: file.name, path, size: file.size, uploaded_at: new Date().toISOString() }];
    await (supabase as any).from("re_clients").update({ kyc_documents: next }).eq("id", id);
    toast.success("Uploaded");
    qc.invalidateQueries({ queryKey: ["re-client", id] });
    qc.invalidateQueries({ queryKey: ["re-clients"] });
  };

  const remove = async (path: string) => {
    if (!id) return;
    await supabase.storage.from("attachments").remove([path]);
    const next = docs.filter((d) => d.path !== path);
    await (supabase as any).from("re_clients").update({ kyc_documents: next }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["re-client", id] });
  };

  const download = async (path: string) => {
    const { data } = await supabase.storage.from("attachments").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const setStatus = async (kyc_status: string) => {
    if (!id) return;
    await (supabase as any).from("re_clients").update({ kyc_status }).eq("id", id);
    toast.success("KYC updated");
    qc.invalidateQueries({ queryKey: ["re-client", id] });
    qc.invalidateQueries({ queryKey: ["re-clients"] });
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>KYC Documents · {client?.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">KYC status:</span>
            <Select value={client?.kyc_status || "pending"} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{KYC.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 border border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/30">
            <Upload className="h-4 w-4" /><span className="text-sm">Upload document (PAN, Aadhaar, Income Proof…)</span>
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <div className="space-y-2">
            {docs.length === 0 ? <div className="text-sm text-muted-foreground text-center py-4">No documents uploaded</div> :
              docs.map((d) => (
                <div key={d.path} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2 text-sm min-w-0"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{d.name}</span></div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => download(d.path)}>View</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(d.path)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
