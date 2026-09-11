import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, IndianRupee, Plus, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { downloadCsv, objectsToCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/realestate/pipeline")({
  component: RealEstatePipeline,
});

type Stage = "inquiry" | "qualified" | "site_visit_scheduled" | "site_visit_done" | "negotiation" | "offer_made" | "agreement" | "token_paid" | "closed_won";

const stages: { key: Stage; label: string; color: string }[] = [
  { key: "inquiry", label: "Inquiry", color: "border-t-muted-foreground" },
  { key: "qualified", label: "Qualified", color: "border-t-info" },
  { key: "site_visit_scheduled", label: "Site Visit Scheduled", color: "border-t-primary" },
  { key: "site_visit_done", label: "Site Visit Done", color: "border-t-primary" },
  { key: "negotiation", label: "Negotiation", color: "border-t-warning" },
  { key: "offer_made", label: "Offer Made", color: "border-t-warning" },
  { key: "agreement", label: "Agreement", color: "border-t-info" },
  { key: "token_paid", label: "Token Paid", color: "border-t-success" },
  { key: "closed_won", label: "Closed Won", color: "border-t-success" },
];

const emptyForm = { client_id: "", property_id: "", expected_value: "", final_value: "", stage: "inquiry", notes: "", next_action_at: "" };

function RealEstatePipeline() {
  const qc = useQueryClient();
  const { user, isManager, isAdmin } = useAuth();
  const [dragId, setDragId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["re-pipeline"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("re_deals")
        .select("id, stage, expected_value, final_value, notes, next_action_at, client_id, property_id, owner_id, agent_id, updated_at, re_clients(full_name, phone), re_properties(title, city)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({ queryKey: ["re-cli-min"], queryFn: async () => (await (supabase as any).from("re_clients").select("id, full_name")).data ?? [] });
  const { data: props = [] } = useQuery({ queryKey: ["re-prop-min"], queryFn: async () => (await (supabase as any).from("re_properties").select("id, title, price")).data ?? [] });

  useRealtimeTable("re_deals", [["re-pipeline"], ["re-deals-kpi"]]);

  const canEditDeal = (d: any) => isManager || d.owner_id === user?.id || d.agent_id === user?.id;

  const move = async (id: string, stage: Stage) => {
    const patch: any = { stage };
    if (stage === "closed_won") patch.closed_at = new Date().toISOString();
    const { error } = await (supabase as any).from("re_deals").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${stage.replace(/_/g, " ")}`);
    qc.invalidateQueries({ queryKey: ["re-pipeline"] });
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      client_id: d.client_id ?? "",
      property_id: d.property_id ?? "",
      expected_value: d.expected_value ?? "",
      final_value: d.final_value ?? "",
      stage: d.stage,
      notes: d.notes ?? "",
      next_action_at: d.next_action_at ? String(d.next_action_at).slice(0, 10) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_id) { toast.error("Pick a client"); return; }
    const payload: any = {
      client_id: form.client_id,
      property_id: form.property_id || null,
      expected_value: form.expected_value ? Number(form.expected_value) : null,
      final_value: form.final_value ? Number(form.final_value) : null,
      stage: form.stage,
      notes: form.notes,
      next_action_at: form.next_action_at ? new Date(form.next_action_at).toISOString() : null,
    };
    if (!editing) { payload.owner_id = user?.id; payload.agent_id = user?.id; }
    if (form.stage === "closed_won") payload.closed_at = new Date().toISOString();
    const { error } = editing
      ? await (supabase as any).from("re_deals").update(payload).eq("id", editing.id)
      : await (supabase as any).from("re_deals").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Deal updated" : "Deal added");
    setOpen(false); setEditing(null); setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["re-pipeline"] });
  };

  const del = async () => {
    if (!editing || !confirm("Delete this deal?")) return;
    const { error } = await (supabase as any).from("re_deals").delete().eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deal deleted");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["re-pipeline"] });
  };

  const exportCsv = () => {
    const headers = ["client", "property", "city", "stage", "expected_value", "final_value", "next_action_at", "notes"];
    const out = deals.map((d: any) => ({
      client: d.re_clients?.full_name, property: d.re_properties?.title, city: d.re_properties?.city,
      stage: d.stage, expected_value: d.expected_value, final_value: d.final_value,
      next_action_at: d.next_action_at, notes: d.notes,
    }));
    downloadCsv(`re-deals-${Date.now()}.csv`, objectsToCsv(out as never, headers));
  };

  const inr = (n: any) => n ? "₹" + (Number(n) / 100000).toFixed(1) + "L" : "—";

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 pb-2">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Deal Pipeline · 9 Stages</h2>
          <p className="text-sm text-muted-foreground">Drag cards across stages · click a card to edit</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Deal</Button>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto p-6 pt-2">
        <div className="flex gap-3 min-w-max pb-4">
          {stages.map((s) => {
            const items = deals.filter((d: any) => d.stage === s.key);
            const value = items.reduce((sum: number, d: any) => sum + Number(d.expected_value || 0), 0);
            return (
              <div key={s.key} className="w-72 flex-shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, s.key)}>
                <Card className={`border-t-4 ${s.color} p-3 mb-2`}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{s.label}</div>
                    <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><IndianRupee className="h-3 w-3" />{inr(value)}</div>
                </Card>
                <div className="space-y-2">
                  {items.map((d: any) => (
                    <Card key={d.id} draggable onDragStart={() => setDragId(d.id)} onDragEnd={() => setDragId(null)}
                      onClick={() => canEditDeal(d) ? openEdit(d) : toast.info("You can only edit deals assigned to you")}
                      className="p-3 cursor-pointer hover:shadow-elegant transition-shadow">
                      <div className="font-medium text-sm">{d.re_clients?.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{d.re_clients?.phone}</div>
                      {d.re_properties && <div className="text-xs mt-1 truncate">🏠 {d.re_properties.title}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-[10px]">{d.re_properties?.city || "—"}</Badge>
                        <span className="text-xs font-semibold">{inr(d.final_value || d.expected_value)}</span>
                      </div>
                      {d.next_action_at && (
                        <div className="text-[10px] text-muted-foreground mt-1">Next: {new Date(d.next_action_at).toLocaleDateString()}</div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Deal" : "New Deal"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select client *" /></SelectTrigger>
              <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue placeholder="Property (optional)" /></SelectTrigger>
              <SelectContent>{props.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="Expected value (₹)" value={form.expected_value} onChange={(e) => setForm({ ...form, expected_value: e.target.value })} />
            <Input type="number" placeholder="Final value (₹)" value={form.final_value} onChange={(e) => setForm({ ...form, final_value: e.target.value })} />
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={form.next_action_at} onChange={(e) => setForm({ ...form, next_action_at: e.target.value })} />
            <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {editing && isAdmin && (
                <Button variant="ghost" onClick={del}><Trash2 className="h-4 w-4 mr-1 text-destructive" />Delete</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Save changes" : "Create Deal"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
