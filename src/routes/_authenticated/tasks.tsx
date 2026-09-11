import { usePermissions } from "@/hooks/use-permissions";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { useServerFn } from "@tanstack/react-start";
import { deleteRecord } from "@/lib/rbac.functions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, CheckSquare, Trash2, Calendar, Paperclip, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  AttachmentList, AttachmentPicker, uploadTaskAttachments, type TaskAttachment,
} from "@/components/task-attachments";

import { DatePicker, DateTimePicker } from "@/components/ui/datetime-picker";
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

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — DigiCRM AI" },
      { name: "description", content: "Assignable to-dos with priority, due dates, attachments and full task details." },
    ],
  }),
  component: TasksPage,
});

type Status = "todo" | "in_progress" | "done" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";
interface Task {
  id: string; title: string; description: string | null; status: Status;
  priority: Priority; due_date: string | null; completed_at: string | null;
  created_at: string; created_by: string | null; assigned_to: string | null;
  attachments: TaskAttachment[];
}

const priorityColors: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  urgent: "bg-destructive/15 text-destructive",
};

const empty = { title: "", description: "", status: "todo" as Status, priority: "medium" as Priority, due_date: "" };

/** Turns a stored ISO date into the value a datetime-local input expects. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TasksPage() {
  const perms = usePermissions();
  const canCreate = perms.canCreate("tasks");
  const canEdit = perms.canEdit("tasks");
  const canDelete = perms.canDelete("tasks");
  const qc = useQueryClient();
  const deleteRecordFn = useServerFn(deleteRecord);
  useRealtimeTable("tasks", [["tasks"]]);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { group: crmGroup } = useActiveIndustry();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filter, crmGroup],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
      q = scopeToIndustry(q, crmGroup);
      if (filter === "open") q = q.in("status", ["todo", "in_progress"]);
      if (filter === "done") q = q.eq("status", "done");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        ...t,
        attachments: Array.isArray(t.attachments) ? (t.attachments as TaskAttachment[]) : [],
      })) as Task[];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["task-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      const map: Record<string, string> = {};
      for (const p of (data ?? []) as any[]) map[p.id] = p.full_name || p.email || "—";
      return map;
    },
  });

  const detail = (tasks ?? []).find((t) => t.id === detailId) ?? null;

  const openNew = () => { setEditingId(null); setForm(empty); setPickedFiles([]); setOpen(true); };
  const openEdit = (t: Task) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      due_date: toLocalInput(t.due_date),
    });
    setPickedFiles([]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Please give the task a title.");
      const due = form.due_date ? new Date(form.due_date) : null;
      if (due && Number.isNaN(due.getTime())) throw new Error("The due date is not valid.");
      if (due && (due.getFullYear() < 1900 || due.getFullYear() > 2999)) {
        throw new Error("Please enter a due date with a four-digit year.");
      }

      const base = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        due_date: due ? due.toISOString() : null,
      };

      if (editingId) {
        const existing = (tasks ?? []).find((t) => t.id === editingId);
        const added = pickedFiles.length ? await uploadTaskAttachments(editingId, pickedFiles) : [];
        const { error } = await supabase
          .from("tasks")
          .update({ ...base, attachments: [...(existing?.attachments ?? []), ...added] as any })
          .eq("id", editingId);
        if (error) throw error;
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...base, created_by: user?.id, assigned_to: user?.id, industry_group: crmGroup })
        .select("id")
        .single();
      if (error) throw error;
      if (pickedFiles.length) {
        const uploaded = await uploadTaskAttachments(data.id, pickedFiles);
        await supabase.from("tasks").update({ attachments: uploaded as any }).eq("id", data.id);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Task updated" : "Task created");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false); setForm(empty); setPickedFiles([]); setEditingId(null);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const removeAttachment = useMutation({
    mutationFn: async ({ task, file }: { task: Task; file: TaskAttachment }) => {
      await supabase.storage.from("attachments").remove([file.path]);
      const { error } = await supabase
        .from("tasks")
        .update({ attachments: task.attachments.filter((a) => a.path !== file.path) as any })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Attachment removed"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const done = t.status !== "done";
      const { error } = await supabase.from("tasks").update({
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await deleteRecordFn({ data: { module: "tasks", id } }); },
    onSuccess: () => { toast.success("Deleted"); setDetailId(null); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your daily to-dos, deadlines and files.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
            </SelectContent>
          </Select>
          {canCreate && <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> New Task</Button>}
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          {isLoading && <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
          {!isLoading && tasks?.length === 0 && (
            <div className="text-center py-16">
              <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No tasks. Create your first one.</p>
            </div>
          )}
          <div className="space-y-2">
            {tasks?.map(t => {
              const done = t.status === "done";
              const overdue = t.due_date && new Date(t.due_date) < new Date() && !done;
              return (
                <div key={t.id} className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors ${done ? "opacity-60" : ""}`}>
                  <Checkbox checked={done} disabled={!canEdit} onCheckedChange={() => toggle.mutate(t)} className="mt-0.5" />
                  <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setDetailId(t.id)}>
                    <p className={`font-medium text-sm ${done ? "line-through" : ""}`}>{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={`${priorityColors[t.priority]} border-0 text-[10px] capitalize`}>{t.priority}</Badge>
                      {t.due_date && (
                        <span className={`text-xs flex items-center gap-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" />{new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {t.attachments.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />{t.attachments.length}
                        </span>
                      )}
                    </div>
                  </button>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit task" : "New task"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(["low", "medium", "high", "urgent"] as Priority[]).map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
              <Label>Due Date</Label>
              <DatePicker
                value={form.due_date}
                onChange={(val) => setForm({ ...form, due_date: val })}
                placeholder="Select Due Date"
              />
            </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Attachments</Label>
              <AttachmentPicker files={pickedFiles} onChange={setPickedFiles} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task details */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.title}</DialogTitle>
                <DialogDescription className="capitalize">
                  {detail.status.replace("_", " ")} · {detail.priority} priority
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description</p>
                  <p className="whitespace-pre-wrap">{detail.description || "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Due date</p>
                    <p className="font-medium">{detail.due_date ? new Date(detail.due_date).toLocaleString() : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(detail.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created by</p>
                    <p className="font-medium">{(detail.created_by && people?.[detail.created_by]) || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned to</p>
                    <p className="font-medium">{(detail.assigned_to && people?.[detail.assigned_to]) || "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Attachments ({detail.attachments.length})
                  </p>
                  <AttachmentList
                    items={detail.attachments}
                    onRemove={canEdit ? (file) => removeAttachment.mutate({ task: detail, file }) : undefined}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailId(null)}>Close</Button>
                {canEdit && <Button onClick={() => { setDetailId(null); openEdit(detail); }}>Edit</Button>}
                {canDelete && (
                  <Button variant="destructive" onClick={() => del.mutate(detail.id)} disabled={del.isPending}>
                    {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
