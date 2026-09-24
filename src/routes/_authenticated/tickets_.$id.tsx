import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Send, Clock, User, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/feature-gate";

export const Route = createFileRoute("/_authenticated/tickets_/$id")({
  head: () => ({ meta: [{ title: "Ticket — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: TicketDetail,
});

type TicketMessage = {
  id: number;
  ticket_id: number;
  sender_id: number | null;
  sender_type: string;
  sender_name: string | null;
  sender_email: string | null;
  message: string;
  is_internal: boolean;
  created_at: string;
};

type TicketAttachment = {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
};

type TicketDetailData = {
  id: number;
  tenant_id: number;
  subject: string;
  description: string | null;
  ticket_number: string;
  requester_name: string | null;
  requester_email: string;
  requester_phone: string | null;
  status: string;
  priority: string;
  urgency: string;
  category: string | null;
  assigned_to: number | null;
  sla_due_at: string | null;
  sla_breached: boolean;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
};

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiFetch<TicketDetailData>(`/api/v1/tickets/${id}`),
    // Poll instead of a realtime subscription so new replies show up.
    refetchInterval: 15000,
  });

  const [reply, setReply] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const sendReply = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: reply, is_internal: !isPublic }),
      }),
    onSuccess: () => {
      setReply("");
      toast.success("Reply sent");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiFetch(`/api/v1/tickets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePriority = useMutation({
    mutationFn: (priority: string) =>
      apiFetch(`/api/v1/tickets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ priority }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!ticket) return <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>;

  const replies = ticket.messages ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tickets"><ArrowLeft className="h-4 w-4 mr-1" /> Back to tickets</Link>
        </Button>
        <div className="text-xs text-muted-foreground font-mono">#{ticket.ticket_number}</div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{ticket.subject}</CardTitle>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{ticket.requester_name ?? ticket.requester_email}</span>
                <span>·</span>
                <span>{new Date(ticket.created_at).toLocaleString()}</span>
              </div>
            </CardHeader>
            <CardContent>
              {ticket.description && <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>}
            </CardContent>
          </Card>

          <div className="space-y-3">
            {replies.map((r) => (
              <Card key={r.id} className={r.is_internal ? "bg-amber-500/5 border-amber-500/30" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {r.sender_name ?? r.sender_email ?? "Agent"}
                      {r.is_internal && <Badge variant="outline" className="ml-2 text-[10px]">Internal note</Badge>}
                    </div>
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reply</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={6} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                  {isPublic ? "Public reply (customer sees this)" : "Internal note (agents only)"}
                </label>
                <Button onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
                  {sendReply.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={ticket.status} onValueChange={(v) => updateStatus.mutate(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={ticket.priority} onValueChange={(v) => updatePriority.mutate(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> SLA</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Due</span><span>{ticket.sla_due_at ? new Date(ticket.sla_due_at).toLocaleString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">First response</span><span>{ticket.first_response_at ? new Date(ticket.first_response_at).toLocaleString() : "—"}</span></div>
              {ticket.sla_breached && (
                <div className="text-destructive text-xs flex items-center gap-1 mt-2">
                  <AlertTriangle className="h-3 w-3" /> SLA breached
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Requester</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div>{ticket.requester_name ?? "—"}</div>
              <a href={`mailto:${ticket.requester_email}`} className="text-primary hover:underline">{ticket.requester_email}</a>
              {ticket.requester_phone && <div className="text-xs text-muted-foreground mt-1">{ticket.requester_phone}</div>}
            </CardContent>
          </Card>

          <FeatureGate feature="tickets.macros">
            <Card>
              <CardHeader><CardTitle className="text-sm">Macros</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Configure one-click macros under Settings → Ticket macros.
              </CardContent>
            </Card>
          </FeatureGate>
        </div>
      </div>
    </div>
  );
}