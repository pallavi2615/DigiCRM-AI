import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard, ADMINS } from "@/components/role-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { objectsToCsv, downloadCsv } from "@/lib/csv";
import { Download, HandCoins, Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payout-history")({
  head: () => ({
    meta: [
      { title: "Partner Payout History — DigiCRM AI" },
      { name: "description", content: "Every partner payout request, what was approved, when the payment was processed and why any request was turned down." },
      { property: "og:title", content: "Partner Payout History" },
      { property: "og:description", content: "Approved amounts, payment dates and rejection reasons for every affiliate partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard allow={ADMINS} module="payout-history" label="Payout History">
      <PayoutHistoryPage />
    </RoleGuard>
  ),
});

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
  processed_at: string | null;
  affiliate_id: string;
  affiliates: { name: string; email: string; referral_code: string | null } | null;
  tenants: { name: string } | null;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const when = (v: string | null) =>
  v ? new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

const tone = (s: string) =>
  s === "paid" ? "bg-green-500/15 text-green-600"
    : s === "approved" ? "bg-blue-500/15 text-blue-600"
      : s === "rejected" ? "bg-destructive/15 text-destructive"
        : "bg-amber-500/15 text-amber-600";

function PayoutHistoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payout-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_payout_requests")
        .select(
          "id, amount, method, status, notes, decision_reason, reference, created_at, approved_at, paid_at, processed_at, affiliate_id, affiliates(name, email, referral_code), tenants(name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.affiliates?.name, r.affiliates?.email, r.tenants?.name, r.reference, r.decision_reason]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, status]);

  const totals = useMemo(() => {
    const sum = (f: (r: Row) => boolean) => filtered.filter(f).reduce((s, r) => s + Number(r.amount), 0);
    return {
      requested: sum((r) => r.status === "requested"),
      approved: sum((r) => r.status === "approved"),
      paid: sum((r) => r.status === "paid"),
      rejected: sum((r) => r.status === "rejected"),
    };
  }, [filtered]);

  const byPartner = useMemo(() => {
    const map = new Map<string, { name: string; email: string; requests: number; approved: number; paid: number; rejected: number; last: string | null }>();
    for (const r of filtered) {
      const key = r.affiliate_id;
      const e = map.get(key) ?? {
        name: r.affiliates?.name ?? "Partner",
        email: r.affiliates?.email ?? "",
        requests: 0, approved: 0, paid: 0, rejected: 0, last: null as string | null,
      };
      e.requests += 1;
      if (r.status === "approved") e.approved += Number(r.amount);
      if (r.status === "paid") { e.paid += Number(r.amount); e.approved += Number(r.amount); }
      if (r.status === "rejected") e.rejected += Number(r.amount);
      const stamp = r.paid_at ?? r.approved_at ?? r.created_at;
      if (!e.last || (stamp && stamp > e.last)) e.last = stamp;
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => b.paid - a.paid);
  }, [filtered]);

  const exportCsv = () => {
    const rowsOut = filtered.map((r) => ({
      partner: r.affiliates?.name ?? "",
      email: r.affiliates?.email ?? "",
      workspace: r.tenants?.name ?? "Direct",
      amount: r.amount,
      method: r.method,
      status: r.status,
      requested_on: r.created_at,
      approved_on: r.approved_at ?? "",
      paid_on: r.paid_at ?? "",
      reference: r.reference ?? "",
      reason: r.decision_reason ?? "",
    }));
    downloadCsv(
      "partner-payout-history.csv",
      objectsToCsv(rowsOut, [
        "partner", "email", "workspace", "amount", "method", "status",
        "requested_on", "approved_on", "paid_on", "reference", "reason",
      ]),
    );
  };


  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <HandCoins className="h-6 w-6" /> Partner payout history
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every request a partner has raised, what was approved, when the payment went out, and why anything was turned down.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Awaiting decision", value: totals.requested },
          { label: "Approved, not yet paid", value: totals.approved },
          { label: "Paid out", value: totals.paid },
          { label: "Rejected", value: totals.rejected },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-xl font-semibold">{inr(k.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Totals per partner</CardTitle>
          <CardDescription>Approved includes amounts already paid.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPartner.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No payout activity yet.</TableCell></TableRow>
              ) : byPartner.map((p) => (
                <TableRow key={p.email || p.name}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </TableCell>
                  <TableCell className="text-right">{p.requests}</TableCell>
                  <TableCell className="text-right">{inr(p.approved)}</TableCell>
                  <TableCell className="text-right font-medium">{inr(p.paid)}</TableCell>
                  <TableCell className="text-right">{inr(p.rejected)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{when(p.last)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search partner, workspace, reference or reason" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="requested">Awaiting decision</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Request history</CardTitle>
          <CardDescription>{filtered.length} request{filtered.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nothing matches this filter.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Reference / reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.affiliates?.name ?? "Partner"}</div>
                      <div className="text-xs text-muted-foreground">{r.affiliates?.email ?? ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">{r.tenants?.name ?? "Direct"}</TableCell>
                    <TableCell className="text-right">{inr(Number(r.amount))}</TableCell>
                    <TableCell><Badge className={tone(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{when(r.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{when(r.approved_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{when(r.paid_at)}</TableCell>
                    <TableCell className="max-w-[240px] text-xs">
                      {r.reference && <div>{r.method.replace(/_/g, " ")} · {r.reference}</div>}
                      {r.decision_reason && (
                        <div className={r.status === "rejected" ? "text-destructive" : "text-muted-foreground"}>{r.decision_reason}</div>
                      )}
                      {!r.reference && !r.decision_reason && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
