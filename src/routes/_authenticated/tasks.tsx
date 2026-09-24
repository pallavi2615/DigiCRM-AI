import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiFetch, apiUpload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Loader2, CheckSquare, Trash2, Calendar, Pencil,
  Paperclip, X, Upload, FileText, Image as ImageIcon, Download,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/datetime-picker";

export const Route = createFileRoute("/_authenticated/tasks")({
  validateSearch: (search: Record<string, unknown>) => ({
    filter: (search.filter as string) || "all",
  }),
  head: () => ({
    meta: [
      { title: "Tasks — DigiCRM AI" },
      { name: "description", content: "Track your daily to-dos with priority and due dates." },
    ],
  }),
  component: TasksPage,
});

// ============================================================
// TYPES
// ============================================================

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface TaskAttachment {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface Task {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: number | null;
  created_by: number | null;
  lead_id: number | null;
  contact_id: number | null;
  company_id: number | null;
  deal_id: number | null;
  tags: any[];
  attachments: TaskAttachment[];
  created_at: string;
  updated_at: string;
}

interface TaskCreatePayload {
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  assigned_to?: number | null;
}

const priorityColors: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors: Record<TaskStatus, string> = {
  pending: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const empty: TaskCreatePayload = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  due_date: null,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================
// PAGE
// ============================================================

function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { filter: filterParam } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskCreatePayload>(empty);
  const [filter, setFilter] = useState<string>(filterParam ?? "all");
  const [detailId, setDetailId] = useState<number | null>(null);

  // ⭐ Attachment state (for new task)
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (filterParam) setFilter(filterParam);
  }, [filterParam]);
  // -------- Fetch tasks --------
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter === "open") params.append("status", "pending");
      if (filter === "done") params.append("status", "completed");
      const query = params.toString();
      return apiFetch<Task[]>(`/api/v1/tasks${query ? `?${query}` : ""}`);
    },
  });
  const visibleTasks = (tasks ?? []).filter((t) => {
    if (filter !== "today") return true;
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date.startsWith(today);
  });

  const detail = (tasks ?? []).find((t) => t.id === detailId) ?? null;

  // ⭐ Fetch attachments for the detail task
  const { data: detailAttachments } = useQuery({
    queryKey: ["task-attachments", detailId],
    queryFn: () =>
      apiFetch<TaskAttachment[]>(`/api/v1/tasks/${detailId}/attachments`),
    enabled: !!detailId,
  });

  // -------- File handlers --------
  const handleFilesPicked = (files: FileList | null) => {
    if (!files) return;
    const valid: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((f) => {
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name} is over 10 MB`);
      } else {
        valid.push(f);
      }
    });

    if (errors.length) toast.error(errors.join("\n"));
    setPickedFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setPickedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const openNew = () => {
    setEditingId(null);
    setForm(empty);
    setPickedFiles([]);
    setOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description ?? "",
      status: t.status,
      priority: t.priority,
      due_date: toDateInput(t.due_date),
      assigned_to: t.assigned_to,
    });
    setPickedFiles([]);
    setOpen(true);
  };

  // -------- Upload attachments (called after task is created) --------
  const uploadAttachments = async (taskId: number, files: File[]) => {
    if (!files.length) return;

    if (files.length === 1) {
      // Single file
      const formData = new FormData();
      formData.append("file", files[0]);
      await apiUpload(`/api/v1/tasks/${taskId}/attachments`, formData);
    } else {
      // Multiple files
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      await apiUpload(`/api/v1/tasks/${taskId}/attachments/bulk`, formData);
    }
  };

  // -------- Create / Update --------
  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Please give the task a title.");

      const payload: any = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to ?? user?.id ?? null,
      };

      let taskId: number;

      if (editingId) {
        // Update existing task
        await apiFetch(`/api/v1/tasks/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        taskId = editingId;
      } else {
        // Create new task
        const created = await apiFetch<Task>("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        taskId = created.id;
      }

      // Upload attachments (if any)
      if (pickedFiles.length > 0) {
        await uploadAttachments(taskId, pickedFiles);
      }

      return { taskId, attachmentsCount: pickedFiles.length };
    },
    onSuccess: (result) => {
      const msg = result.attachmentsCount
        ? `Task ${editingId ? "updated" : "created"} with ${result.attachmentsCount} attachment${result.attachmentsCount > 1 ? "s" : ""}`
        : `Task ${editingId ? "updated" : "created"}`;
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-attachments"] });
      setOpen(false);
      setForm(empty);
      setPickedFiles([]);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Toggle status --------
  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const newStatus: TaskStatus =
        t.status === "completed" ? "pending" : "completed";
      await apiFetch(`/api/v1/tasks/${t.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Delete task --------
  const del = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted");
      setDetailId(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Delete attachment --------
  const deleteAttachment = useMutation({
    mutationFn: ({ taskId, attachmentId }: { taskId: number; attachmentId: number }) =>
      apiFetch(`/api/v1/tasks/${taskId}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Attachment deleted");
      qc.invalidateQueries({ queryKey: ["task-attachments"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Upload attachments directly from detail dialog --------
  const [detailUploading, setDetailUploading] = useState(false);
  const handleDetailUpload = async (taskId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const valid: File[] = [];
    const errors: string[] = [];
    Array.from(files).forEach((f) => {
      if (f.size > MAX_FILE_SIZE) errors.push(`${f.name} is over 10 MB`);
      else valid.push(f);
    });

    if (errors.length) toast.error(errors.join("\n"));
    if (!valid.length) return;

    setDetailUploading(true);
    try {
      await uploadAttachments(taskId, valid);
      toast.success(`${valid.length} file${valid.length > 1 ? "s" : ""} uploaded`);
      qc.invalidateQueries({ queryKey: ["task-attachments"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setDetailUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track your daily to-dos and deadlines.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
               <SelectItem value="today">Today</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          {isLoading && (
            <div className="text-center py-10">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </div>
          )}

         {!isLoading && visibleTasks.length === 0 && (
            <div className="text-center py-16">
              <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === "today" ? "No tasks due today." : "No tasks. Create your first one."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {visibleTasks?.map((t) => {
              const done = t.status === "completed";
              const overdue =
                t.due_date && new Date(t.due_date) < new Date() && !done;
              const attachCount =
                Array.isArray(t.attachments) ? t.attachments.length : 0;

              return (
                <div
                  key={t.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors ${
                    done ? "opacity-60" : ""
                  }`}
                >
                  <Checkbox
                    checked={done}
                    onCheckedChange={() => toggle.mutate(t)}
                    className="mt-0.5"
                  />

                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setDetailId(t.id)}
                  >
                    <p
                      className={`font-medium text-sm ${
                        done ? "line-through" : ""
                      }`}
                    >
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        className={`${
                          priorityColors[t.priority] ||
                          "bg-gray-100 text-gray-700"
                        } border-0 text-[10px] capitalize`}
                      >
                        {t.priority}
                      </Badge>
                      {t.due_date && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            overdue
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {attachCount > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          {attachCount}
                        </span>
                      )}
                    </div>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => del.mutate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as TaskStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm({ ...form, priority: v as TaskPriority })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "medium", "high", "urgent"] as TaskPriority[]).map(
                      (p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <DatePicker
                value={form.due_date ?? ""}
                onChange={(val) => setForm({ ...form, due_date: val })}
                placeholder="Select Due Date"
              />
            </div>

            {/* ⭐ Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments (max 10 MB each)
              </Label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    document.getElementById("task-file-input")?.click()
                  }
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Files
                </Button>
                <input
                  id="task-file-input"
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    handleFilesPicked(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {pickedFiles.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {pickedFiles.map((file, i) => {
                    const isImage = file.type.startsWith("image/");
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md border p-2 text-xs"
                      >
                        {isImage ? (
                          <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                        )}
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingId ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
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
                  <p className="text-xs text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="whitespace-pre-wrap">
                    {detail.description || "—"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Due date</p>
                    <p className="font-medium">
                      {detail.due_date
                        ? new Date(detail.due_date).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {new Date(detail.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* ⭐ Attachments Section (with upload + delete + download) */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({(detailAttachments ?? []).length})
                  </p>

                  {/* Upload button */}
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        document.getElementById("detail-file-input")?.click()
                      }
                      disabled={detailUploading}
                    >
                      {detailUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload
                    </Button>
                    <input
                      id="detail-file-input"
                      type="file"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                      className="hidden"
                      onChange={(e) => {
                        handleDetailUpload(detail.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Attachment list */}
                  {(detailAttachments ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No attachments yet.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    {(detailAttachments ?? []).map((a) => {
                      const isImage = a.file_type?.startsWith("image/");
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 rounded-md border p-2 text-xs"
                        >
                          {isImage ? (
                            <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          )}
                          <span className="flex-1 truncate">{a.file_name}</span>
                          <span className="text-muted-foreground">
                            {formatFileSize(a.file_size)}
                          </span>
                          <a
                            href={a.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() =>
                              deleteAttachment.mutate({
                                taskId: detail.id,
                                attachmentId: a.id,
                              })
                            }
                            disabled={deleteAttachment.isPending}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailId(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setDetailId(null);
                    openEdit(detail);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => del.mutate(detail.id)}
                  disabled={del.isPending}
                >
                  {del.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}