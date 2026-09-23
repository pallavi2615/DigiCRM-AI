import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, RefreshCcw, Trash2, Inbox, Eye } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/webhook-dead-letter")({
  head: () => ({ meta: [{ title: "Webhook Retries — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="webhook-dead-letter" label="Webhook Dead Letter">
      <DeadLetterPage />
    </RoleGuard>
  ),
});

const QUERY_KEY = "webhook-events";
const BASE = "/api/v1/webhook-events";

type WebhookEvent = {
  id: number;
  tenant_id: number | null;
  event_id: string;
  webhook_id: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  response_status: number | null;
  created_at: string;
  updated_at: string;
};
type WebhookStats = { retrying: number; dead_letter: number; success: number; failed: number };

// Assumes the {event_id} path param is the string event_id. If the backend expects the numeric id, use e.id here.
const eventPath = (e: WebhookEvent) => `${BASE}/${encodeURIComponent(e.event_id)}`;

// apiFetch throws the raw response body; unwrap FastAPI's {"detail": ...} for toasts.
const errMsg = (err: unknown, fallback: string) => {
  const raw = err instanceof Error ? err.message : "";
  try {
    const d = JSON.parse(raw)?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x: any) => x.msg).join(", ");
  } catch { /* not JSON */ }
  return raw || fallback;
};

function DeadLetterPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"retrying" | "dead">("retrying");
  const [detailsFor, setDetailsFor] = useState<WebhookEvent | null>(null);

  const { data: stats } = useQuery({
    queryKey: [QUERY_KEY, "stats"],
    queryFn: () => apiFetch<WebhookStats>(`${BASE}/stats`),
    enabled: isAdmin,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY, "list", tab],
    queryFn: () => apiFetch<WebhookEvent[]>(tab === "dead" ? `${BASE}/dead-letter` : `${BASE}/retrying`),
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

  const refresh = () => qc.invalidateQueries({ queryKey: [QUERY_KEY] });

  const onRetry = async (e: WebhookEvent) => {
    try {
      const updated = await apiFetch<WebhookEvent>(`${eventPath(e)}/retry`, { method: "POST" });
      if (updated.status === "success") toast.success("Retry successful");
      else toast.info(`Retry attempted — status: ${updated.status}`);
      refresh();
    } catch (err: any) {
      toast.error(errMsg(err, "Retry failed"));
    }
  };

  const onDelete = async (e: WebhookEvent) => {
    if (!window.confirm(`Delete event ${e.event_id}? This cannot be undone.`)) return;
    try {
      await apiFetch(eventPath(e), { method: "DELETE" });
      toast.success("Event deleted");
      if (detailsFor?.id === e.id) setDetailsFor(null);
      refresh();
    } catch (err: any) {
      toast.error(errMsg(err, "Delete failed"));
    }
  };

  const count = (n: number | undefined) => (n ?? "…");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Inbox className="h-6 w-6" /> Webhook retry & dead-letter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Failed HMAC-validated events with exponential backoff. Duplicate events (same <code>event_id</code>) never create a second audit row.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "retrying" ? "default" : "outline"} onClick={() => setTab("retrying")}>
          Retrying ({count(stats?.retrying)})
        </Button>
        <Button size="sm" variant={tab === "dead" ? "default" : "outline"} onClick={() => setTab("dead")}>
          Dead-letter ({count(stats?.dead_letter)})
        </Button>
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
                  <TableHead>Status</TableHead>
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
                    <TableCell className="font-mono text-xs">{l.event_id}</TableCell>
                    <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{l.attempts}/{l.max_attempts}</Badge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate" title={l.last_error ?? ""}>{l.last_error ?? "—"}</TableCell>
                    <TableCell className="text-xs">{l.next_retry_at ? new Date(l.next_retry_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => setDetailsFor(l)}><Eye className="h-3 w-3 mr-1" />Details</Button>
                      <Button size="sm" variant="outline" onClick={() => onRetry(l)}><RefreshCcw className="h-3 w-3 mr-1" />Retry</Button>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(l)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      <Dialog open={!!detailsFor} onOpenChange={(o) => !o && setDetailsFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4" /> Event details</DialogTitle>
          </DialogHeader>
          {detailsFor && (
            <div className="space-y-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">event_id</dt>
                <dd className="font-mono break-all">{detailsFor.event_id}</dd>
                <dt className="text-muted-foreground">webhook_id</dt>
                <dd className="font-mono break-all">{detailsFor.webhook_id ?? "—"}</dd>
                <dt className="text-muted-foreground">status</dt>
                <dd>{detailsFor.status}</dd>
                <dt className="text-muted-foreground">attempts</dt>
                <dd>{detailsFor.attempts} / {detailsFor.max_attempts}</dd>
                <dt className="text-muted-foreground">response status</dt>
                <dd>{detailsFor.response_status ?? "—"}</dd>
                <dt className="text-muted-foreground">next retry</dt>
                <dd>{detailsFor.next_retry_at ? new Date(detailsFor.next_retry_at).toLocaleString() : "—"}</dd>
                <dt className="text-muted-foreground">created</dt>
                <dd>{new Date(detailsFor.created_at).toLocaleString()}</dd>
                <dt className="text-muted-foreground">updated</dt>
                <dd>{new Date(detailsFor.updated_at).toLocaleString()}</dd>
              </dl>

              {detailsFor.last_error && (
                <div>
                  <div className="text-xs font-medium mb-1">Last error</div>
                  <div className="text-xs text-destructive break-all">{detailsFor.last_error}</div>
                </div>
              )}

              <div>
                <div className="text-xs font-medium mb-1">Payload</div>
                <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-64">
                  {JSON.stringify(detailsFor.payload ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}