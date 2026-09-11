import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";


type Row = {
  id: string;
  amount: number;
  method: string;
  status: string;
  notes: string | null;
  decision_reason: string | null;
  reference: string | null;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  tenant_id: string | null;
  affiliates: { name: string; email: string } | null;
  tenants: { name: string } | null;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const tone = (s: string) =>
  s === "paid" ? "bg-green-500/15 text-green-600"
    : s === "approved" ? "bg-blue-500/15 text-blue-600"
      : s === "rejected" ? "bg-destructive/15 text-destructive"
        : "bg-amber-500/15 text-amber-600";

export function AffiliatePayoutQueue() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["affiliate-payout-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_payout_requests")
        .select("id, amount, method, status, notes, decision_reason, reference, created_at, approved_at, paid_at, tenant_id, affiliates(name, email), tenants(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status, decisionReason }: { id: string; status: string; decisionReason?: string }) => {
      const patch: Record<string, unknown> = {
        status,
        processed_by: user?.id ?? null,
        processed_at: new Date().toISOString(),
      };
      const ref = refs[id]?.trim();
      if (ref) patch['reference'] = ref;
      if (decisionReason !== undefined) patch['decision_reason'] = decisionReason;
      const { error } = await supabase
        .from("affiliate_payout_requests")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout request updated");
      setRejecting(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["affiliate-payout-requests"] });
      qc.invalidateQueries({ queryKey: ["payout-history"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });


  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Partner payment requests</CardTitle>
        <CardDescription>Approve, mark as paid or reject the payouts partners have requested.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No payment requests yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.affiliates?.name ?? "Partner"}</div>
                    <div className="text-xs text-muted-foreground">{r.affiliates?.email ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.tenants?.name ?? "Direct"}</TableCell>
                  <TableCell className="text-right">{inr(Number(r.amount))}</TableCell>
                  <TableCell className="text-xs">{r.method.replace(/_/g, " ")}</TableCell>
                  <TableCell>
                    <Badge className={tone(r.status)}>{r.status}</Badge>
                    {r.decision_reason && (
                      <div className={`mt-1 max-w-[180px] text-[11px] ${r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                        {r.decision_reason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.status === "paid" || r.status === "rejected" ? (
                      <span className="text-xs text-muted-foreground">{r.reference ?? "—"}</span>
                    ) : (
                      <Input
                        className="h-8 w-32"
                        placeholder="UTR / ref"
                        value={refs[r.id] ?? ""}
                        onChange={(e) => setRefs((p) => ({ ...p, [r.id]: e.target.value }))}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "requested" && (
                      <Button size="sm" variant="outline" disabled={update.isPending}
                        onClick={() => update.mutate({ id: r.id, status: "approved" })}>Approve</Button>
                    )}
                    {r.status !== "paid" && r.status !== "rejected" && (
                      <Button size="sm" disabled={update.isPending}
                        onClick={() => update.mutate({ id: r.id, status: "paid" })}>Mark paid</Button>
                    )}
                    {r.status !== "paid" && r.status !== "rejected" && (
                      <Button size="sm" variant="ghost" disabled={update.isPending}
                        onClick={() => { setRejecting(r); setReason(""); }}>Reject</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payout request</DialogTitle>
            <DialogDescription>
              {rejecting ? `${rejecting.affiliates?.name ?? "Partner"} · ${inr(Number(rejecting.amount))}` : ""}
              {" — the partner sees this reason on their dashboard."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payout-reason">Reason</Label>
            <Textarea
              id="payout-reason"
              rows={3}
              placeholder="e.g. Commission on this deal is not yet received from the client."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || update.isPending}
              onClick={() => rejecting && update.mutate({ id: rejecting.id, status: "rejected", decisionReason: reason.trim() })}
            >
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

  );
}
