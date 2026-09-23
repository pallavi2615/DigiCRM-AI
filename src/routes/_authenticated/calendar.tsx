import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Video, CheckSquare, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — DigiCRM AI" }] }),
  component: CalendarPage,
});

interface CalendarEvent {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  meeting_link: string | null;
  attendees: string[];
  lead_id: number | null;
  contact_id: number | null;
  created_at: string;
}

interface Meeting {
  id: number;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_link: string | null;
  location: string | null;
  created_at: string;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

// Unified shape the calendar grid renders, regardless of source endpoint.
interface Ev {
  id: number;
  title: string;
  date: string;
  type: "meeting" | "task";
  origin: "calendar" | "meeting" | "task";
}

function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const qc = useQueryClient();
  const perms = usePermissions();
  const [selected, setSelected] = useState<Date | null>(null);
  const [mode, setMode] = useState<"meeting" | "task">("meeting");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [time, setTime] = useState("10:00");

  const openDay = (day: number) => {
    setSelected(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    setMode("meeting"); setTitle(""); setDetails(""); setTime("10:00");
  };

  // -------- Fetch calendar events + meetings + tasks, merge into one list --------
  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar", "meetings", "tasks"],
    queryFn: async (): Promise<Ev[]> => {
      const [calendarEvents, meetings, tasks] = await Promise.all([
        apiFetch<CalendarEvent[]>("/api/v1/calendar"),
        apiFetch<Meeting[]>("/api/v1/meetings"),
        apiFetch<Task[]>("/api/v1/tasks"),
      ]);

      const fromCalendar: Ev[] = calendarEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.start_time,
        type: "meeting",
        origin: "calendar",
      }));

      const fromMeetings: Ev[] = meetings.map((m) => ({
        id: m.id,
        title: m.title,
        date: m.scheduled_at,
        type: "meeting",
        origin: "meeting",
      }));

      const fromTasks: Ev[] = tasks
        .filter((t) => !!t.due_date)
        .map((t) => ({
          id: t.id,
          title: t.title,
          date: t.due_date as string,
          type: "task",
          origin: "task",
        }));

      return [...fromCalendar, ...fromMeetings, ...fromTasks];
    },
  });

  // -------- Create meeting (via /api/v1/meetings) or task --------
  const addEntry = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      if (!title.trim()) throw new Error("Add a title first");
      const [h, m] = time.split(":").map(Number);
      const start = new Date(selected);
      start.setHours(h || 9, m || 0, 0, 0);

      if (mode === "meeting") {
        return apiFetch<Meeting>("/api/v1/meetings", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: details || null,
            agenda: null,
            scheduled_at: start.toISOString(),
            duration_minutes: 30,
            meeting_type: "video",
            location: null,
            meeting_link: null,
            attendees: [],
            lead_id: null,
            contact_id: null,
            company_id: null,
          }),
        });
      } else {
        return apiFetch<Task>("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: details || null,
            status: "pending",
            priority: "medium",
            due_date: start.toISOString(),
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(mode === "meeting" ? "Meeting scheduled" : "Task created");
      qc.invalidateQueries({ queryKey: ["calendar"] });
      setSelected(null);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  // -------- Remove an entry (routes to the right endpoint by origin) --------
  const removeEntry = useMutation({
    mutationFn: (ev: Ev) => {
      if (ev.origin === "calendar") return apiFetch<void>(`/api/v1/calendar/${ev.id}`, { method: "DELETE" });
      if (ev.origin === "meeting") return apiFetch<void>(`/api/v1/meetings/${ev.id}`, { method: "DELETE" });
      return apiFetch<void>(`/api/v1/tasks/${ev.id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const cells = Array.from({ length: startOffset + daysInMonth }, (_, i) => {
    if (i < startOffset) return null;
    return i - startOffset + 1;
  });
  const today = new Date();

  const evsFor = (day: number) => (events ?? []).filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth() && d.getDate() === day;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Meetings and task deadlines at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold min-w-40 text-center">{cursor.toLocaleString("en", { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</Button>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading calendar…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} className="text-xs font-semibold text-center text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} className="aspect-square" />;
                  const isToday = today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === day;
                  const evs = evsFor(day);
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => openDay(day)}
                      aria-label={`Open ${cursor.toLocaleString("en", { month: "long" })} ${day}`}
                      className={`min-h-24 w-full text-left p-1.5 rounded border ${isToday ? "border-primary bg-primary/5" : "border-border"} hover:bg-muted/40 transition-colors`}
                    >
                      <div className={`text-xs font-medium ${isToday ? "text-primary" : ""}`}>{day}</div>
                      <div className="space-y-0.5 mt-1">
                        {evs.slice(0, 3).map(e => (
                          <div key={`${e.origin}-${e.id}`} className={`text-[10px] px-1 py-0.5 rounded truncate ${e.type === "meeting" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                            {e.type === "meeting" ? <Video className="inline h-2.5 w-2.5 mr-0.5" /> : <CheckSquare className="inline h-2.5 w-2.5 mr-0.5" />}
                            {e.title}
                          </div>
                        ))}
                        {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex gap-3 mt-4 text-xs text-muted-foreground">
            <Badge variant="secondary" className="bg-info/15 text-info border-0"><Video className="h-3 w-3 mr-1" />Meetings</Badge>
            <Badge variant="secondary" className="bg-warning/15 text-warning border-0"><CheckSquare className="h-3 w-3 mr-1" />Tasks</Badge>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</DialogTitle>
            <DialogDescription>Everything scheduled for this day, and quick actions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {selected && evsFor(selected.getDate()).length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
              )}
              {selected && evsFor(selected.getDate()).map((e) => (
                <div key={`${e.origin}-${e.id}`} className="flex items-center gap-2 rounded border p-2 text-sm">
                  {e.type === "meeting" ? <Video className="h-3.5 w-3.5 text-info" /> : <CheckSquare className="h-3.5 w-3.5 text-warning" />}
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(e.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => removeEntry.mutate(e)}
                    disabled={removeEntry.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            {(perms.canCreate("meetings") || perms.canCreate("tasks")) && (
              <div className="space-y-3 border-t pt-3">
                <div className="flex gap-2">
                  {perms.canCreate("meetings") && (
                    <Button size="sm" variant={mode === "meeting" ? "default" : "outline"} onClick={() => setMode("meeting")}>
                      <Video className="mr-2 h-4 w-4" /> Meeting
                    </Button>
                  )}
                  {perms.canCreate("tasks") && (
                    <Button size="sm" variant={mode === "task" ? "default" : "outline"} onClick={() => setMode("task")}>
                      <CheckSquare className="mr-2 h-4 w-4" /> Task
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5"><Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "meeting" ? "Demo call with Acme" : "Send pricing sheet"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Time</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Details</Label>
                  <Textarea rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {(perms.canCreate("meetings") || perms.canCreate("tasks")) && (
              <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
                {addEntry.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add {mode}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}