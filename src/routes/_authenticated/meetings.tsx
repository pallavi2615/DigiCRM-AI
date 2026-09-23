import { usePermissions } from "@/hooks/use-permissions";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Video, Loader2, MapPin, Link as LinkIcon, Trash2, Eye, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/datetime-picker";

const validateDate = (d: string) => {
  if (!d || d.trim() === "") {
    throw new Error("Date is required");
  }

  const date = new Date(d);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }

  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new Error(`Year must be between 1900 and 2100 (got: ${year})`);
  }

  return date.toISOString();
};

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "Meetings — DigiCRM AI" }] }),
  component: MeetingsPage,
});

interface Meeting {
  id: number;
  tenant_id: number;
  title: string;
  description: string | null;
  agenda: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type: string | null;
  location: string | null;
  meeting_link: string | null;
  attendees: string[];
  notes: string | null;
  outcome: string | null;
  lead_id: number | null;
  contact_id: number | null;
  company_id: number | null;
  created_at: string;
}

const empty = {
  title: "",
  description: "",
  agenda: "",
  scheduled_at: "",
  duration_minutes: 30,
  meeting_type: "video",
  location: "",
  meeting_link: "",
};

function MeetingsPage() {
  const perms = usePermissions();
  const canCreate = perms.canCreate("meetings");
  const canEdit = perms.canEdit("meetings");
  const canDelete = perms.canDelete("meetings");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState<Meeting | null>(null);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: () => apiFetch<Meeting[]>("/api/v1/meetings"),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.scheduled_at) throw new Error("Title and scheduled time required");

      const scheduledAt = validateDate(form.scheduled_at);

      return apiFetch<Meeting>("/api/v1/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          agenda: form.agenda || null,
          scheduled_at: scheduledAt,
          duration_minutes: form.duration_minutes || 30,
          meeting_type: form.meeting_type || "video",
          location: form.location || null,
          meeting_link: form.meeting_link || null,
          attendees: [],
          lead_id: null,
          contact_id: null,
          company_id: null,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Meeting scheduled");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/v1/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch<Meeting>(`/api/v1/meetings/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast.success("Meeting updated");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setDetail(null);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const now = new Date();
  const upcoming = (meetings ?? []).filter(m => new Date(m.scheduled_at) >= now);
  const past = (meetings ?? []).filter(m => new Date(m.scheduled_at) < now);

  const endTime = (m: Meeting) => new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 0) * 60 * 1000);

  const renderCard = (m: Meeting) => {
    const start = new Date(m.scheduled_at);
    const end = endTime(m);
    return (
      <Card key={m.id} className="shadow-card hover:shadow-elegant transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold">{m.title}</h4>
              {m.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>}
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span>{start.toLocaleString()} — {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                {m.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.location}</span>}
                {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><LinkIcon className="h-3 w-3" />Join</a>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{m.status}</Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="View details" onClick={() => setDetail(m)}><Eye className="h-3.5 w-3.5" /></Button>
              {canDelete && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Meetings</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule and manage your sales meetings.</p>
        </div>
        {canCreate && <Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Schedule</Button>}
      </div>

      {isLoading && <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
      {!isLoading && meetings?.length === 0 && (
        <Card className="shadow-card"><CardContent className="text-center py-16">
          <Video className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
        </CardContent></Card>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Upcoming ({upcoming.length})</h3>
          <div className="space-y-2">{upcoming.map(renderCard)}</div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Past</h3>
          <div className="space-y-2 opacity-70">{past.slice(0, 10).map(renderCard)}</div>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription className="capitalize">{detail?.status}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                {new Date(detail.scheduled_at).toLocaleString()} — {endTime(detail).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              {detail.agenda && <div><p className="text-xs text-muted-foreground">Agenda</p><p>{detail.agenda}</p></div>}
              {detail.description && <div><p className="text-xs text-muted-foreground">Description</p><p>{detail.description}</p></div>}
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{detail.location || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Join link</p>
                  {detail.meeting_link
                    ? <a className="text-primary hover:underline break-all" href={detail.meeting_link} target="_blank" rel="noreferrer">Open</a>
                    : <p className="font-medium">—</p>}
                </div>
              </div>
              {detail.notes && <div><p className="text-xs text-muted-foreground">Notes</p><p>{detail.notes}</p></div>}
              {detail.outcome && <div><p className="text-xs text-muted-foreground">Outcome</p><p>{detail.outcome}</p></div>}
              {canEdit && (
                <div className="flex gap-2 pt-1 flex-wrap">
                  {["scheduled", "completed", "cancelled", "no_show"].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={detail.status === s ? "default" : "outline"}
                      disabled={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: detail.id, status: s })}
                      className="capitalize"
                    >
                      {s.replace("_", " ")}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule meeting</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Agenda</Label><Textarea rows={2} value={form.agenda} onChange={(e) => setForm({...form, agenda: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Scheduled at</Label>
                <DateTimePicker
                  value={form.scheduled_at}
                  onChange={(val) => setForm({ ...form, scheduled_at: val })}
                  placeholder="Select date & time"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 30 })}
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Meeting URL</Label><Input placeholder="https://meet.google.com/..." value={form.meeting_link} onChange={(e) => setForm({...form, meeting_link: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}