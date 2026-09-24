import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Plus, Trash2, CheckCircle2, Clock,
  Phone, Mail, MessageSquare, ClipboardList, Bell, User, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/followups")({
  head: () => ({ meta: [{ title: "Follow-ups — DigiCRM AI" }] }),
  component: FollowupsPage,
});


interface SequenceStep {
  id: number;
  step_order: number;
  delay_days: number;
  action_type: string;
  title: string;
  description: string | null;
  template: string | null;
}

interface Sequence {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  total_steps: number;
  steps: SequenceStep[];
  created_at: string;
}

interface Task {
  id: number;
  tenant_id: number;
  lead_id: number;
  sequence_id: number | null;
  step_id: number | null;
  title: string;
  description: string | null;
  action_type: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: number | null;
  notes: string | null;
  created_at: string;
}

interface TaskForm {
  step_order: number;
  delay_days: number;
  action_type: string;
  title: string;
  description: string;
}

interface Lead {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  company_name: string | null;
}


const actionIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  task: ClipboardList,
  notification: Bell,
};

const actionColors: Record<string, string> = {
  call: "bg-blue-100 text-blue-700",
  email: "bg-purple-100 text-purple-700",
  whatsapp: "bg-green-100 text-green-700",
  task: "bg-gray-100 text-gray-700",
  notification: "bg-yellow-100 text-yellow-700",
};

const statusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  skipped: "bg-gray-100 text-gray-700",
};

const emptyStep: TaskForm = {
  step_order: 1,
  delay_days: 1,
  action_type: "call",
  title: "",
  description: "",
};


function FollowupsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");

  // -------- Fetch sequences --------
  const { data: sequences = [], isLoading: seqLoading } = useQuery({
    queryKey: ["followup-sequences"],
    queryFn: () => apiFetch<Sequence[]>("/api/v1/followups/sequences"),
  });

  // -------- Fetch tasks --------
  const { data: tasks = [], isLoading: taskLoading } = useQuery({
    queryKey: ["followup-tasks"],
    queryFn: () => apiFetch<Task[]>("/api/v1/followups/tasks"),
  });

  // -------- Fetch leads (for names in the task grouping) --------
  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => apiFetch<Lead[]>("/api/v1/leads"),
  });

  const leadNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const l of leads) map.set(l.id, l.name);
    return map;
  }, [leads]);

  // -------- Delete sequence --------
  const deleteSequence = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/v1/followups/sequences/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Sequence deleted");
      qc.invalidateQueries({ queryKey: ["followup-sequences"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Update task status --------
  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/v1/followups/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Task updated");
      qc.invalidateQueries({ queryKey: ["followup-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // -------- Delete task --------
  const deleteTask = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/v1/followups/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["followup-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  // -------- Group tasks by lead, for the hover-to-expand list --------
  const leadGroups = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of tasks) {
      const list = map.get(t.lead_id) ?? [];
      list.push(t);
      map.set(t.lead_id, list);
    }
    return Array.from(map.entries())
      .map(([leadId, leadTasks]) => ({
        leadId,
        tasks: leadTasks.sort((a, b) => {
          // Pending/in-progress first, then by due date
          const rank = (s: string) => (s === "completed" || s === "skipped" ? 1 : 0);
          if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }),
      }))
      .sort((a, b) => {
        const aPending = a.tasks.filter((t) => t.status === "pending").length;
        const bPending = b.tasks.filter((t) => t.status === "pending").length;
        return bPending - aPending;
      });
  }, [tasks]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Follow-ups</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automate lead follow-ups with sequences and tasks.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Sequence
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Sequences"
          value={sequences.length}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Pending Tasks"
          value={pendingTasks.length}
          color="text-blue-600"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="In Progress"
          value={inProgressTasks.length}
          color="text-yellow-600"
          icon={<Loader2 className="h-4 w-4" />}
        />
        <StatCard
          label="Completed"
          value={completedTasks.length}
          color="text-green-600"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="sequences">
            Sequences ({sequences.length})
          </TabsTrigger>
        </TabsList>

        {/* ============ TASKS TAB ============ */}
        <TabsContent value="tasks" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leads with follow-ups</CardTitle>
              <p className="text-xs text-muted-foreground">
                Hover a lead to see its follow-up tasks.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {taskLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </div>
              ) : leadGroups.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-muted-foreground">
                    No tasks yet. Attach a sequence to a lead to create tasks.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {leadGroups.map(({ leadId, tasks: leadTasks }) => {
                    const pending = leadTasks.filter((t) => t.status === "pending").length;
                    return (
                      <div key={leadId} className="group/lead">
                        {/* Lead row — hovering this reveals the tasks below */}
                        <div className="flex items-center gap-3 px-4 py-3 cursor-default hover:bg-muted/40 transition-colors">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {leadNameById.get(leadId) ?? `Lead #${leadId}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {leadTasks.length} task{leadTasks.length > 1 ? "s" : ""}
                              {pending > 0 && (
                                <span className="text-blue-600"> · {pending} pending</span>
                              )}
                            </div>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover/lead:rotate-180" />
                        </div>

                        {/* Task list — collapsed by default, expands on hover of the group */}
                        <div className="grid grid-rows-[0fr] group-hover/lead:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                          <div className="overflow-hidden">
                            <div className="px-4 pb-3 pl-13 space-y-1.5">
                              {leadTasks.map((task) => {
                                const Icon = actionIcons[task.action_type || "task"] || ClipboardList;
                                return (
                                  <div
                                    key={task.id}
                                    className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm"
                                  >
                                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">{task.title}</div>
                                      {task.description && (
                                        <div className="text-xs text-muted-foreground truncate">
                                          {task.description}
                                        </div>
                                      )}
                                    </div>
                                    <Badge
                                      className={`${
                                        actionColors[task.action_type || "task"]
                                      } border-0 capitalize shrink-0`}
                                    >
                                      {task.action_type || "task"}
                                    </Badge>
                                    <Badge
                                      className={`${statusColors[task.status]} border-0 capitalize shrink-0`}
                                    >
                                      {task.status.replace("_", " ")}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
                                      {task.due_date
                                        ? new Date(task.due_date).toLocaleDateString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                          })
                                        : "—"}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {task.status === "pending" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2"
                                          onClick={() =>
                                            updateTask.mutate({ id: task.id, status: "completed" })
                                          }
                                          disabled={updateTask.isPending}
                                        >
                                          <CheckCircle2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2"
                                        onClick={() => deleteTask.mutate(task.id)}
                                        disabled={deleteTask.isPending}
                                      >
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SEQUENCES TAB ============ */}
        <TabsContent value="sequences" className="space-y-4 mt-4">
          {seqLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : sequences.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No sequences yet. Create your first follow-up sequence.
                </p>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sequence
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sequences.map((seq) => (
                <Card key={seq.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{seq.name}</CardTitle>
                      {seq.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {seq.description}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete sequence "${seq.name}"?`)) {
                          deleteSequence.mutate(seq.id);
                        }
                      }}
                      disabled={deleteSequence.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {seq.total_steps} steps
                      </Badge>
                      <Badge
                        variant={seq.is_active ? "default" : "outline"}
                      >
                        {seq.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      {seq.steps?.map((step) => {
                        const Icon =
                          actionIcons[step.action_type] || ClipboardList;
                        return (
                          <div
                            key={step.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="text-xs text-muted-foreground w-6">
                              #{step.step_order}
                            </span>
                            <Icon className="h-3 w-3" />
                            <span className="flex-1">{step.title}</span>
                            <span className="text-xs text-muted-foreground">
                              Day {step.delay_days}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Sequence Dialog */}
      {createOpen && (
        <CreateSequenceDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() =>
            qc.invalidateQueries({ queryKey: ["followup-sequences"] })
          }
        />
      )}
    </div>
  );
}

// ============================================================
// CREATE SEQUENCE DIALOG
// ============================================================

function CreateSequenceDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<TaskForm[]>([{ ...emptyStep }]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/followups/sequences", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          is_active: true,
          steps: steps.map((s, i) => ({
            step_order: i + 1,
            delay_days: s.delay_days,
            action_type: s.action_type,
            title: s.title,
            description: s.description || null,
          })),
        }),
      }),
    onSuccess: () => {
      toast.success("Sequence created");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStep = () =>
    setSteps([
      ...steps,
      {
        ...emptyStep,
        step_order: steps.length + 1,
        delay_days: steps.length + 1,
      },
    ]);

  const removeStep = (i: number) =>
    setSteps(steps.filter((_, idx) => idx !== i));

  const updateStep = (i: number, patch: Partial<TaskForm>) =>
    setSteps(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Sequence name is required");
      return;
    }
    if (steps.some((s) => !s.title.trim())) {
      toast.error("All steps need a title");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Follow-up Sequence</DialogTitle>
          <DialogDescription>
            Define a series of steps. Tasks will be created automatically when
            the sequence is attached to a lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Sequence Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New Lead Nurture"
            />
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Steps ({steps.length})</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addStep}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Step
              </Button>
            </div>

            {steps.map((step, i) => (
              <div
                key={i}
                className="border rounded-lg p-3 space-y-2 bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-6">
                    #{i + 1}
                  </span>
                  <Select
                    value={step.action_type}
                    onValueChange={(v) =>
                      updateStep(i, { action_type: v })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    className="flex-1"
                    placeholder="Step title"
                    value={step.title}
                    onChange={(e) =>
                      updateStep(i, { title: e.target.value })
                    }
                  />

                  <div className="flex items-center gap-1">
                    <Label className="text-xs">Day</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      value={step.delay_days}
                      onChange={(e) =>
                        updateStep(i, {
                          delay_days: Number(e.target.value) || 1,
                        })
                      }
                    />
                  </div>

                  {steps.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeStep(i)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>

                <Input
                  placeholder="Description (optional)"
                  value={step.description}
                  onChange={(e) =>
                    updateStep(i, { description: e.target.value })
                  }
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Sequence
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  label,
  value,
  color = "",
  icon,
}: {
  label: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}