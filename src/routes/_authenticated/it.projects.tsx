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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { escapePostgrestFilterValue } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/it/projects")({
  component: ITProjectsPage,
});

const STAGES = ["discovery", "proposal", "negotiation", "contract", "kickoff", "in_progress", "uat", "delivered", "closed"];

function ITProjectsPage() {
  const qc = useQueryClient();
  const { user, isManager, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const empty = { name: "", client_name: "", client_email: "", description: "", tech_stack: "", stage: "discovery", budget: "", value: "", start_date: "", end_date: "" };
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["it-projects", q],
    queryFn: async () => {
      let query = (supabase as any).from("it_projects").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`name.ilike.%${escapePostgrestFilterValue(q)}%,client_name.ilike.%${escapePostgrestFilterValue(q)}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    const payload = {
      ...form,
      budget: form.budget ? Number(form.budget) : null,
      value: form.value ? Number(form.value) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      owner_id: edit?.owner_id ?? user?.id,
      manager_id: edit?.manager_id ?? user?.id,
    };
    const { error } = edit
      ? await (supabase as any).from("it_projects").update(payload).eq("id", edit.id)
      : await (supabase as any).from("it_projects").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(edit ? "Project updated" : "Project added");
    setOpen(false); setEdit(null); setForm(empty);
    qc.invalidateQueries({ queryKey: ["it-projects"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    const { error } = await (supabase as any).from("it_projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["it-projects"] });
  };

  const openEdit = (row: any) => {
    setEdit(row);
    setForm({ ...empty, ...row, budget: row.budget ?? "", value: row.value ?? "", start_date: row.start_date ?? "", end_date: row.end_date ?? "" });
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Projects</h2>
          <p className="text-sm text-muted-foreground">Client engagements from discovery to delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search project/client" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead><TableHead>Client</TableHead><TableHead>Stack</TableHead>
              <TableHead>Stage</TableHead><TableHead>Value</TableHead><TableHead>Timeline</TableHead><TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow> :
              rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No projects yet.</TableCell></TableRow> :
              rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.client_name}<br/><span className="text-muted-foreground">{r.client_email}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.tech_stack || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.stage?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm">{r.value ? `₹${(r.value/100000).toFixed(1)}L` : "—"}</TableCell>
                  <TableCell className="text-xs">{r.start_date || "—"} → {r.end_date || "—"}</TableCell>
                  <TableCell className="text-right">
                    {(isManager || r.owner_id === user?.id || r.manager_id === user?.id) && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <Input className="md:col-span-2" placeholder="Project name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Client name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            <Input placeholder="Client email" type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
            <Input className="md:col-span-2" placeholder="Tech stack (React, Node, AWS...)" value={form.tech_stack} onChange={(e) => setForm({ ...form, tech_stack: e.target.value })} />
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <div />
            <Input placeholder="Budget (₹)" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            <Input placeholder="Value (₹)" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            <Input placeholder="Start date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <Input placeholder="End date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            <Textarea className="md:col-span-2" placeholder="Description / SOW" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
