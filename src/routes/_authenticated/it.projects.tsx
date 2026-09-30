import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/it/projects")({
  component: ITProjectsPage,
});

const STAGES = ["discovery", "proposal", "negotiation", "contract", "kickoff", "in_progress", "uat", "delivered", "closed"];

/* ---- API types (match app/schemas/it_project.py) ---- */
interface ITProject {
  id: number;
  name: string;
  client_name: string | null;
  client_email: string | null;
  stack: string | null;
  description: string | null;
  stage: string;
  value: number | null;
  currency?: string | null;
  start_date: string | null;
  end_date: string | null;
  owner_id: number | null;
  created_at?: string;
}

interface ITProjectListResponse {
  data: ITProject[];
  total: number;
  skip: number;
  limit: number;
}

const emptyForm = {
  name: "",
  client_name: "",
  client_email: "",
  description: "",
  stack: "",
  stage: "discovery",
  value: "",
  start_date: "",
  end_date: "",
};
type FormState = typeof emptyForm;

function ITProjectsPage() {
  const qc = useQueryClient();
  const { user, isManager, isAdmin } = useAuth();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<ITProject | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // avoid firing a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  /* ---------------- List (GET /it/projects) ---------------- */
  const { data, isLoading } = useQuery({
    queryKey: ["it-projects", debouncedQ],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (debouncedQ) params.set("search", debouncedQ);
      return apiFetch<ITProjectListResponse>(`/api/v1/it/projects?${params.toString()}`);
    },
  });
  const rows = data?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["it-projects"] });

  /* ---------------- Create / Update ---------------- */
  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        stack: form.stack || null,
        description: form.description || null,
        stage: form.stage,
        value: form.value ? Number(form.value) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };

      if (edit) {
        // PUT /it/projects/{id}
        return apiFetch<ITProject>(`/api/v1/it/projects/${edit.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      // POST /it/projects — new projects are owned by the creator
      const ownerId = Number(user?.id);
      if (Number.isFinite(ownerId)) payload.owner_id = ownerId;

      return apiFetch<ITProject>("/api/v1/it/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success(edit ? "Project updated" : "Project added");
      setOpen(false);
      setEdit(null);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- Delete (DELETE /it/projects/{id}) ---------------- */
  const del = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/v1/it/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Project deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDelete = (id: number) => {
    if (!confirm("Delete this project?")) return;
    del.mutate(id);
  };

  const openNew = () => {
    setEdit(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row: ITProject) => {
    setEdit(row);
    setForm({
      name: row.name ?? "",
      client_name: row.client_name ?? "",
      client_email: row.client_email ?? "",
      description: row.description ?? "",
      stack: row.stack ?? "",
      stage: row.stage ?? "discovery",
      value: row.value != null ? String(row.value) : "",
      start_date: row.start_date ?? "",
      end_date: row.end_date ?? "",
    });
    setOpen(true);
  };

  const canEdit = (r: ITProject) =>
    isManager || (r.owner_id != null && String(r.owner_id) === String(user?.id));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Projects</h2>
          <p className="text-sm text-muted-foreground">Client engagements from discovery to delivery</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search project/client" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
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
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No projects yet.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs">{r.client_name}<br /><span className="text-muted-foreground">{r.client_email}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.stack || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.stage?.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-sm">{r.value ? `₹${(r.value / 100000).toFixed(1)}L` : "—"}</TableCell>
                  <TableCell className="text-xs">{r.start_date || "—"} → {r.end_date || "—"}</TableCell>
                  <TableCell className="text-right">
                    {canEdit(r) && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} disabled={del.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
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
            <Input className="md:col-span-2" placeholder="Tech stack (React, Node, AWS...)" value={form.stack} onChange={(e) => setForm({ ...form, stack: e.target.value })} />
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Value (₹)" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            <Input placeholder="Start date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <Input placeholder="End date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            <Textarea className="md:col-span-2" placeholder="Description / SOW" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}