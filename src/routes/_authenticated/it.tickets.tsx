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
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { escapePostgrestFilterValue } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/it/tickets")({
  component: ITTicketsPage,
});

const PRIORITY = ["low", "medium", "high", "urgent"];
const STATUS = ["open", "in_progress", "blocked", "resolved", "closed"];
const TYPE = ["task", "bug", "feature", "support"];

function ITTicketsPage() {
  const qc = useQueryClient();
  const { user, isManager } = useAuth();
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const empty = { project_id: "", title: "", description: "", priority: "medium", status: "open", ticket_type: "task", due_date: "" };
  const [form, setForm] = useState<any>(empty);

  // Realtime: instantly reflect ticket status changes for all authorized users
  useRealtimeTable("it_tickets", [["it-tickets"]]);
  useRealtimeTable("it_projects", [["it-proj-min"]]);

  const { data: projects = [] } = useQuery({ queryKey: ["it-proj-min"], queryFn: async () => (await (supabase as any).from("it_projects").select("id, name")).data ?? [] });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["it-tickets", q, statusF],
    queryFn: async () => {
      let query = (supabase as any).from("it_tickets").select("*, it_projects(name)").order("created_at", { ascending: false });
      if (q) query = query.or(`title.ilike.%${escapePostgrestFilterValue(q)}%,description.ilike.%${escapePostgrestFilterValue(q)}%`);
      if (statusF !== "all") query = query.eq("status", statusF);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    const payload = {
      ...form,
      project_id: form.project_id || null,
      due_date: form.due_date || null,
      resolved_at: form.status === "resolved" || form.status === "closed" ? new Date().toISOString() : null,
      owner_id: edit?.owner_id ?? user?.id,
      assignee_id: edit?.assignee_id ?? user?.id,
    };
    const { error } = edit
      ? await (supabase as any).from("it_tickets").update(payload).eq("id", edit.id)
      : await (supabase as any).from("it_tickets").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(edit ? "Ticket updated" : "Ticket created");
    setOpen(false); setEdit(null); setForm(empty);
    qc.invalidateQueries({ queryKey: ["it-tickets"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    const { error } = await (supabase as any).from("it_tickets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["it-tickets"] });
  };

  const openEdit = (row: any) => {
    setEdit(row);
    setForm({ ...empty, ...row, due_date: row.due_date ? row.due_date.substring(0, 10) : "" });
    setOpen(true);
  };

  const prioColor = (p: string) => p === "urgent" ? "bg-destructive/15 text-destructive" : p === "high" ? "bg-warning/15 text-warning" : p === "low" ? "bg-muted text-muted-foreground" : "bg-info/15 text-info";
  const statusColor = (s: string) => s === "resolved" || s === "closed" ? "bg-success/15 text-success" : s === "blocked" ? "bg-destructive/15 text-destructive" : s === "in_progress" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Tickets & Tasks</h2>
          <p className="text-sm text-muted-foreground">Track bugs, features and support requests across projects</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search tickets" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead><TableHead>Project</TableHead><TableHead>Type</TableHead>
              <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead><TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow> :
              rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No tickets yet.</TableCell></TableRow> :
              rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium max-w-xs truncate">{r.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.it_projects?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.ticket_type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className={prioColor(r.priority)}>{r.priority}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className={statusColor(r.status)}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-xs">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    {(isManager || r.owner_id === user?.id) && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit Ticket" : "New Ticket"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <Input className="md:col-span-2" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.ticket_type} onValueChange={(v) => setForm({ ...form, ticket_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPE.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITY.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="md:col-span-2" placeholder="Due date" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <Textarea className="md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.title}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
