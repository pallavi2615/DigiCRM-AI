import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { FeatureGate } from "@/components/feature-gate";

export const Route = createFileRoute("/_authenticated/tickets_/$id")({
  head: () => ({ meta: [{ title: "Ticket — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  useRealtimeTable("support_tickets", [["ticket", id]]);
  useRealtimeTable("ticket_replies", [["ticket-replies", id]]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, tenants(name, slug)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["ticket-replies", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_replies")
        .select("id, author_id, author_email, author_name, body, is_public, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cannedResponses = [] } = useQuery({
    queryKey: ["canned", ticket?.tenant_id],
    queryFn: async () => {
      let q = supabase.from("canned_responses").select("id, name, body");
      if (ticket?.tenant_id) q = q.eq("tenant_id", ticket.tenant_id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!ticket,
  });

  const [reply, setReply] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const sendReply = useMutation({
    mutationFn: async () => {
      const { createTicketReplyFn } = await import("@/lib/tickets.functions");
      await createTicketReplyFn({ data: { ticketId: id, body: reply, isPublic } });
    },
    onSuccess: () => {
      setReply("");
      toast.success("Reply sent");
      qc.invalidateQueries({ queryKey: ["ticket-replies", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTicket = useMutation({
    mutationFn: async (patch: { status?: string; priority?: string }) => {
      const p: { status?: string; priority?: string; resolved_at?: string } = { ...patch };
      if (patch.status === "resolved") p.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("support_tickets").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket", id] }); qc.invalidateQueries({ queryKey: ["tickets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!ticket) return <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>;

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
                <span>via {ticket.channel}</span>
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
              <Card key={r.id} className={r.is_public ? "" : "bg-amber-500/5 border-amber-500/30"}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {r.author_name ?? r.author_email ?? "Agent"}
                      {!r.is_public && <Badge variant="outline" className="ml-2 text-[10px]">Internal note</Badge>}
                    </div>
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{r.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Reply</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cannedResponses.length > 0 && (
                <Select onValueChange={(v) => {
                  const c = cannedResponses.find((x) => x.id === v);
                  if (c) setReply(c.body);
                }}>
                  <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Insert canned response" /></SelectTrigger>
                  <SelectContent>
                    {cannedResponses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
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
                <Select value={ticket.status} onValueChange={(v) => updateTicket.mutate({ status: v })}>
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
                <Select value={ticket.priority} onValueChange={(v) => updateTicket.mutate({ priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
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
