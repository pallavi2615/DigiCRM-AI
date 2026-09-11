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
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Video, Loader2, MapPin, Link as LinkIcon, Trash2, Eye, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { DateTimePicker } from "@/components/ui/datetime-picker";
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

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "Meetings — DigiCRM AI" }] }),
  component: MeetingsPage,
});

interface Meeting {
  id: string; title: string; description: string | null;
  starts_at: string; ends_at: string; location: string | null;
  meeting_url: string | null; status: string;
}

const empty = { title: "", description: "", 
  starts_at: "", 
  ends_at: "", 
  location: "", meeting_url: "" };

function MeetingsPage() {
  const perms = usePermissions();
  const canCreate = perms.canCreate("meetings");
  const canEdit = perms.canEdit("meetings");
  const canDelete = perms.canDelete("meetings");
  const qc = useQueryClient();
  const deleteRecordFn = useServerFn(deleteRecord);
  useRealtimeTable("meetings", [["meetings"], ["calendar"]]);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState<Meeting | null>(null);
  const { group: crmGroup } = useActiveIndustry();

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings", crmGroup],
    queryFn: async () => {
      const { data, error } = await scopeToIndustry(supabase.from("meetings").select("*").order("starts_at", { ascending: true }), crmGroup);
      if (error) throw error;
      return (data ?? []) as Meeting[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.starts_at || !form.ends_at) throw new Error("Title and times required");

      const startsAt = validateDate(form.starts_at);
      const endsAt = validateDate(form.ends_at);

      const { error } = await supabase.from("meetings").insert({
        title: form.title, description: form.description || null,
        starts_at: startsAt,  
        ends_at: endsAt,  
        location: form.location || null, meeting_url: form.meeting_url || null,
        status: "scheduled", organizer: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meeting scheduled"); qc.invalidateQueries({ queryKey: ["meetings"] }); setOpen(false); setForm(empty); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await deleteRecordFn({ data: { module: "meetings", id } }); },
    onSuccess: () => { toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("meetings")
        .update({ status: status as "scheduled" | "completed" | "cancelled" | "no_show" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting updated");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setDetail(null);
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const now = new Date();
  const upcoming = (meetings ?? []).filter(m => new Date(m.starts_at) >= now);
  const past = (meetings ?? []).filter(m => new Date(m.starts_at) < now);

  const renderCard = (m: Meeting) => {
    const start = new Date(m.starts_at); const end = new Date(m.ends_at);
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
                {m.meeting_url && <a href={m.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><LinkIcon className="h-3 w-3" />Join</a>}
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
                {new Date(detail.starts_at).toLocaleString()} — {new Date(detail.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              {detail.description && <div><p className="text-xs text-muted-foreground">Agenda</p><p>{detail.description}</p></div>}
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Location</p><p className="font-medium">{detail.location || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Join link</p>
                  {detail.meeting_url
                    ? <a className="text-primary hover:underline break-all" href={detail.meeting_url} target="_blank" rel="noreferrer">Open</a>
                    : <p className="font-medium">—</p>}
                </div>
              </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Starts</Label>
                <DateTimePicker
                  value={form.starts_at}
                  onChange={(val) => setForm({ ...form, starts_at: val })}
                  placeholder="Select start date & time"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Ends</Label>
                <DateTimePicker
                  value={form.ends_at}
                  onChange={(val) => setForm({ ...form, ends_at: val })}
                  placeholder="Select end date & time"
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Meeting URL</Label><Input placeholder="https://meet.google.com/..." value={form.meeting_url} onChange={(e) => setForm({...form, meeting_url: e.target.value})} /></div>
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
