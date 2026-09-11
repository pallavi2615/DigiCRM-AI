import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, RefreshCcw, Ban, Inbox, History, CheckCircle2, XCircle, Copy, Skull, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { retryWebhookEvent, markWebhookDeadLetter } from "@/lib/webhook-retry.functions";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/webhook-dead-letter")({
  head: () => ({ meta: [{ title: "Webhook Retries — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="webhook-dead-letter" label="Webhook Dead Letter">
      <DeadLetterPage />
    </RoleGuard>
  ),
});

type TimelineEntry = { ts: string; type: string; message?: string | null; ok?: boolean; attempt?: number };
type Log = {
  id: string; tenant_id: string | null; event_id: string | null;
  ok: boolean; status_code: number; message: string | null;
  attempts: number; dead_letter: boolean; last_error: string | null;
  next_retry_at: string | null; created_at: string;
  attempts_log: TimelineEntry[] | null;
};

const TIMELINE_ICON: Record<string, any> = {
  received: Inbox, hmac_ok: ShieldCheck, hmac_fail: ShieldX,
  secret_ok: ShieldCheck, secret_fail: ShieldX,
  duplicate: Copy, attempt: RefreshCcw, success: CheckCircle2,
  dead_letter: Skull, reopened: RotateCcw, manual_retry: RefreshCcw,
};
const TIMELINE_TONE: Record<string, string> = {
  hmac_fail: "text-destructive", secret_fail: "text-destructive",
  dead_letter: "text-destructive", success: "text-emerald-600",
  hmac_ok: "text-emerald-600", secret_ok: "text-emerald-600",
};

function DeadLetterPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const retry = useServerFn(retryWebhookEvent);
  const markDead = useServerFn(markWebhookDeadLetter);
  const [tab, setTab] = useState<"failed" | "dead">("failed");
  const [timelineFor, setTimelineFor] = useState<Log | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["dlq", tab],
    queryFn: async () => {
      const q = supabase
        .from("inbound_webhooks_log")
        .select("id, tenant_id, event_id, ok, status_code, message, attempts, dead_letter, last_error, next_retry_at, created_at, attempts_log")
        .eq("ok", false)
        .eq("dead_letter", tab === "dead")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Log[];
    },
    enabled: isAdmin,
  });

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-2">You don't have access to the webhook dead-letter queue.</p>
      </div>
    );
  }

  const onRetry = async (id: string) => {
    try {
      await retry({ data: { logId: id } });
      toast.success("Retry successful");
      qc.invalidateQueries({ queryKey: ["dlq"] });
    } catch (e: any) { toast.error(e.message ?? "Retry failed"); }
  };
  const onDead = async (id: string, dead: boolean) => {
    try {
      await markDead({ data: { logId: id, dead } });
      toast.success(dead ? "Marked dead" : "Reopened");
      qc.invalidateQueries({ queryKey: ["dlq"] });
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Inbox className="h-6 w-6" /> Webhook retry & dead-letter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Failed HMAC-validated events with exponential backoff. Duplicate events (same <code>event_id</code>) never create a second audit row.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "failed" ? "default" : "outline"} onClick={() => setTab("failed")}>Retrying ({tab === "failed" ? logs.length : "…"})</Button>
        <Button size="sm" variant={tab === "dead" ? "default" : "outline"} onClick={() => setTab("dead")}>Dead-letter ({tab === "dead" ? logs.length : "…"})</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Events</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
            logs.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nothing here — all webhooks processed cleanly.</p> :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last error</TableHead>
                  <TableHead>Next retry</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.event_id ?? l.id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="secondary">{l.attempts}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate" title={l.last_error ?? ""}>{l.last_error ?? l.message}</TableCell>
                    <TableCell className="text-xs">{l.next_retry_at ? new Date(l.next_retry_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setTimelineFor(l)}><History className="h-3 w-3 mr-1" />Timeline</Button>
                      <Button size="sm" variant="outline" onClick={() => onRetry(l.id)}><RefreshCcw className="h-3 w-3 mr-1" />Retry</Button>
                      {tab === "failed"
                        ? <Button size="sm" variant="ghost" onClick={() => onDead(l.id, true)}><Ban className="h-3 w-3 mr-1" />Kill</Button>
                        : <Button size="sm" variant="ghost" onClick={() => onDead(l.id, false)}>Reopen</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      <Dialog open={!!timelineFor} onOpenChange={(o) => !o && setTimelineFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Event timeline</DialogTitle>
          </DialogHeader>
          {timelineFor && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                <div>event_id: <span className="font-mono">{timelineFor.event_id ?? "—"}</span></div>
                <div>log id: <span className="font-mono">{timelineFor.id}</span></div>
                <div>attempts: {timelineFor.attempts} · dead-letter: {String(timelineFor.dead_letter)}</div>
              </div>
              <ol className="relative border-l pl-4 space-y-3">
                {(timelineFor.attempts_log ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">No timeline entries recorded.</li>
                )}
                {(timelineFor.attempts_log ?? []).map((e, i) => {
                  const Icon = TIMELINE_ICON[e.type] ?? History;
                  const tone = TIMELINE_TONE[e.type] ?? (e.ok === false ? "text-destructive" : "");
                  return (
                    <li key={i} className="relative">
                      <span className={`absolute -left-6 top-0.5 rounded-full bg-background p-1 border ${tone}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-sm font-medium capitalize ${tone}`}>{e.type.replace(/_/g, " ")}</span>
                        {e.attempt != null && <Badge variant="outline" className="text-[10px]">#{e.attempt}</Badge>}
                        <span className="text-[11px] text-muted-foreground">{new Date(e.ts).toLocaleString()}</span>
                      </div>
                      {e.message && <div className="text-xs text-muted-foreground mt-0.5 break-all">{e.message}</div>}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
