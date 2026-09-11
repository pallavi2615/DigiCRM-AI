import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIndustry, scopeToIndustry } from "@/lib/active-industry";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Ticket, Plus, Search, AlertTriangle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useActiveTenant } from "@/lib/tenants";
import { useRealtimeTable } from "@/lib/use-realtime-table";

export const Route = createFileRoute("/_authenticated/tickets")({
  head: () => ({ meta: [{ title: "Tickets — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: TicketsPage,
});

type Ticket = {
  id: string;
  ticket_number: number;
  subject: string;
  status: string;
  priority: string;
  urgency: string;
  channel: string;
  requester_email: string;
  requester_name: string | null;
  assignee_id: string | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  first_response_at: string | null;
  created_at: string;
  tenant_id: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  resolved: "bg-green-500/10 text-green-500 border-green-500/20",
  closed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-500",
  normal: "bg-blue-500/10 text-blue-500",
  high: "bg-orange-500/10 text-orange-500",
  urgent: "bg-red-500/10 text-red-500",
};
const URGENCY_COLORS: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-500",
  normal: "bg-sky-500/10 text-sky-500",
  high: "bg-amber-500/10 text-amber-500",
  critical: "bg-red-500/10 text-red-500 font-semibold",
};

function TicketsPage() {
  const { active } = useActiveTenant();
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [urgency, setUrgency] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  // Tick every 30s so SLA countdowns stay live without re-fetching.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  useRealtimeTable("support_tickets", [["tickets"]]);

  const { group: crmGroup } = useActiveIndustry();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["tickets", active?.id, crmGroup],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets")
        .select("id, ticket_number, subject, status, priority, urgency, channel, requester_email, requester_name, assignee_id, sla_due_at, sla_breached, first_response_at, created_at, tenant_id")
        .order("created_at", { ascending: false })
        .limit(200);
      if (active?.id) q = q.eq("tenant_id", active.id);
      q = scopeToIndustry(q, crmGroup);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (urgency !== "all" && t.urgency !== urgency) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        t.requester_email.toLowerCase().includes(q) ||
        String(t.ticket_number).includes(q)
      );
    });
  }, [tickets, status, priority, urgency, search]);

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    pending: tickets.filter((t) => t.status === "pending").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    breached: tickets.filter((t) => t.sla_breached).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Ticket className="h-6 w-6" /> Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {active ? `Support inbox for ${active.name}` : "All workspace tickets"}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="All" value={counts.all} onClick={() => setStatus("all")} active={status === "all"} />
        <StatCard label="Open" value={counts.open} onClick={() => setStatus("open")} active={status === "open"} />
        <StatCard label="Pending" value={counts.pending} onClick={() => setStatus("pending")} active={status === "pending"} />
        <StatCard label="Resolved" value={counts.resolved} onClick={() => setStatus("resolved")} active={status === "resolved"} />
        <StatCard label="SLA Breached" value={counts.breached} tone="danger" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search subject, email, #number" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Urgency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All urgencies</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">#</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No tickets yet — try the customer portal or create one.</TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate({ to: "/tickets/$id", params: { id: t.id } })}
                  >
                    <TableCell className="font-mono text-xs">#{t.ticket_number}</TableCell>
                    <TableCell className="max-w-[300px] truncate font-medium">{t.subject}</TableCell>
                    <TableCell className="text-sm">
                      <div>{t.requester_name ?? t.requester_email}</div>
                      {t.requester_name && <div className="text-xs text-muted-foreground">{t.requester_email}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[t.status]}>{t.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded ${URGENCY_COLORS[t.urgency ?? "normal"]}`}>{t.urgency ?? "normal"}</span>
                    </TableCell>
                    <TableCell>
                      <SlaCell dueAt={t.sla_due_at} breached={t.sla_breached} responded={!!t.first_response_at} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {showNew && <NewTicketDialog onClose={() => setShowNew(false)} tenantId={active?.id ?? null} />}
    </div>
  );
}

function StatCard({ label, value, tone, onClick, active }: {
  label: string; value: number; tone?: "danger"; onClick?: () => void; active?: boolean;
}) {
  const cls = active ? "border-primary bg-primary/5" : tone === "danger" ? "border-destructive/40 bg-destructive/5" : "hover:bg-muted/40";
  return (
    <button onClick={onClick} className={`rounded-lg border p-4 text-left transition ${cls}`}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </button>
  );
}

function SlaCell({ dueAt, breached, responded }: { dueAt: string | null; breached: boolean; responded: boolean }) {
  if (!dueAt) return <span className="text-xs text-muted-foreground">—</span>;
  if (responded) return <span className="text-xs text-green-600">Responded</span>;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const mins = Math.round((due - now) / 60000);
  const isBreach = breached || mins < 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${isBreach ? "text-destructive" : "text-muted-foreground"}`}>
      {isBreach ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {isBreach ? `Breached ${Math.abs(mins)}m` : mins > 60 ? `${Math.round(mins / 60)}h` : `${mins}m`}
    </span>
  );
}

function NewTicketDialog({ onClose, tenantId }: { onClose: () => void; tenantId: string | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    subject: "", description: "", priority: "normal", urgency: "normal",
    requester_email: "", requester_name: "",
  });
  const { group: dialogGroup } = useActiveIndustry();
  const create = useMutation({
    mutationFn: async () => {
      const { createTicketFn } = await import("@/lib/tickets.functions");
      await createTicketFn({ data: {
        tenantId: tenantId,
        subject: form.subject,
        description: form.description || null,
        priority: form.priority as "low" | "normal" | "high" | "urgent",
        urgency: form.urgency as "low" | "normal" | "high" | "critical",
        requester_email: form.requester_email,
        requester_name: form.requester_name || null,
        industryGroup: dialogGroup,
      } });
    },
    onSuccess: () => { toast.success("Ticket created"); qc.invalidateQueries({ queryKey: ["tickets"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Ticket</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Requester email</Label>
              <Input type="email" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} />
            </div>
            <div>
              <Label>Requester name</Label>
              <Input value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={5000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.subject || !form.requester_email}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Also link to /tickets/$id — declared here for TS-safe navigation
export const _needed = Link;
