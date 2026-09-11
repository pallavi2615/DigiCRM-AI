import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getPartnerSummary, requestPayout } from "@/lib/affiliate.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HandCoins, IndianRupee, Loader2, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/partner")({
  head: () => ({
    meta: [
      { title: "Partner Payouts | DigiCRM AI" },
      { name: "description", content: "Track your referral earnings for every client workspace and request your commission payout." },
      { property: "og:title", content: "Partner Payouts | DigiCRM AI" },
      { property: "og:description", content: "Referral earnings per workspace and payout requests for DigiCRM partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartnerPortal,
});

type Req = {
  id: string; tenant_id: string | null; amount: number; method: string;
  status: string; notes: string | null; reference: string | null;
  decision_reason: string | null; approved_at: string | null; paid_at: string | null;
  created_at: string; processed_at: string | null;
};


const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const tone = (s: string) =>
  s === "paid" ? "bg-green-500/15 text-green-600"
    : s === "approved" ? "bg-blue-500/15 text-blue-600"
      : s === "rejected" ? "bg-destructive/15 text-destructive"
        : "bg-amber-500/15 text-amber-600";

function PartnerPortal() {
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getPartnerSummary);
  const submitPayout = useServerFn(requestPayout);

  const [open, setOpen] = useState(false);
  const [tenantKey, setTenantKey] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["partner-summary"],
    queryFn: () => fetchSummary(),
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["partner-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_payout_requests")
        .select("id, tenant_id, amount, method, status, notes, reference, decision_reason, approved_at, paid_at, created_at, processed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? { earned: 0, requested: 0, paid: 0, payable: 0, referrals: 0 };
  const affiliate = data?.affiliate ?? null;

  const nameFor = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => m.set(r.tenantId ?? "__none__", r.tenantName));
    return m;
  }, [rows]);

  const selectedRow = rows.find((r) => (r.tenantId ?? "__none__") === tenantKey);

  const mutate = useMutation({
    mutationFn: async () => {
      await submitPayout({
        data: {
          tenantId: tenantKey === "__none__" ? null : tenantKey,
          amount: Number(amount),
          method,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payout request sent to the DigiCRM finance team");
      setOpen(false);
      setAmount("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["partner-requests"] });
      qc.invalidateQueries({ queryKey: ["partner-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send the request"),
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!affiliate) {
    return (
      <div className="p-4 md:p-6">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>You are not a partner yet</CardTitle>
            <CardDescription>
              This page shows referral earnings for approved DigiCRM partners. Apply from the partner page and an
              admin will approve your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><a href="/affiliate">Apply to the partner programme</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pending = affiliate.status !== "approved";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Partner payouts</h1>
          <p className="text-sm text-muted-foreground">
            {affiliate.name} · {affiliate.commissionPct}% of every deal you refer
            {affiliate.referralCode ? ` · code ${affiliate.referralCode}` : ""}
          </p>
        </div>
        <Badge className={tone(pending ? "requested" : "paid")}>{affiliate.status}</Badge>
      </div>

      {pending && (
        <Card className="border-amber-500/40">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Your partner account is awaiting approval. You can see your figures, but payout requests unlock once an
            admin approves you.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Referrals", value: String(totals.referrals), icon: Users },
          { label: "Earned", value: inr(totals.earned), icon: IndianRupee },
          { label: "Awaiting payment", value: inr(totals.requested), icon: HandCoins },
          { label: "Paid out", value: inr(totals.paid), icon: Wallet },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-xl font-semibold">{k.value}</div>
              </div>
              <k.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Earnings per client workspace</CardTitle>
          <CardDescription>Your share is {affiliate.commissionPct}% of the closed value of the deals you referred.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No referrals recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                  <TableHead className="text-right">Deal value</TableHead>
                  <TableHead className="text-right">Your share</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.tenantId ?? "__none__"}>
                    <TableCell className="font-medium">{r.tenantName}</TableCell>
                    <TableCell className="text-right">{r.referrals}</TableCell>
                    <TableCell className="text-right">{r.wonReferrals}</TableCell>
                    <TableCell className="text-right">{inr(r.baseAmount)}</TableCell>
                    <TableCell className="text-right">{inr(r.earned)}</TableCell>
                    <TableCell className="text-right font-semibold">{inr(r.payable)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending || r.payable <= 0}
                        onClick={() => {
                          setTenantKey(r.tenantId ?? "__none__");
                          setAmount(String(Math.round(r.payable)));
                          setOpen(true);
                        }}
                      >
                        Request payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment requests</CardTitle>
          <CardDescription>Every request you have raised and where it stands.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No payment requests yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Raised</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>{nameFor.get(r.tenant_id ?? "__none__") ?? "Workspace"}</TableCell>
                    <TableCell className="text-right">{inr(Number(r.amount))}</TableCell>
                    <TableCell className="text-xs">{r.method.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge className={tone(r.status)}>{r.status}</Badge>
                      {r.decision_reason && (
                        <div className={`mt-1 max-w-[220px] text-[11px] ${r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                          {r.decision_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.approved_at ? new Date(r.approved_at).toLocaleDateString("en-IN") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString("en-IN") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}

              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a payment</DialogTitle>
            <DialogDescription>
              {selectedRow
                ? `${selectedRow.tenantName} · up to ${inr(selectedRow.payable)} available`
                : "Choose how much you would like paid out."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="payout-amount">Amount (₹)</Label>
              <Input id="payout-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-notes">Notes (optional)</Label>
              <Textarea id="payout-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Invoice number, account details reference…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => mutate.mutate()} disabled={mutate.isPending || !amount}>
              {mutate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
