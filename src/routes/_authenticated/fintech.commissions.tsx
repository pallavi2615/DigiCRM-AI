import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Download, DollarSign, Wallet, TrendingUp } from "lucide-react";
import { downloadCsv, objectsToCsv } from "@/lib/csv";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/fintech/commissions")({
  component: CommissionsPage,
});

function CommissionsPage() {
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const canEdit = isManager;
  const [editing, setEditing] = useState<any>(null);
  const [received, setReceived] = useState("");
  const [invoice, setInvoice] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("loan_commissions")
        .select("*, loan_applications(applicant_name, loan_type), lenders(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as any[];
      const ids = [...new Set(list.map((r) => r.agent_id).filter(Boolean))];
      let byId: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, full_name, email").in("id", ids);
        byId = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return list.map((r) => ({ ...r, profiles: r.agent_id ? byId[r.agent_id] ?? null : null }));
    },
  });


  const updateComm = useMutation({
    mutationFn: async () => {
      const payload: any = { received_amount: Number(received || 0), invoice_no: invoice || null };
      if (Number(received) >= Number(editing.expected_amount)) { payload.status = "received"; payload.received_at = new Date().toISOString(); }
      else if (invoice) payload.status = "invoiced";
      const { error } = await (supabase as any).from("loan_commissions").update(payload).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["commissions"] }); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const totals = rows.reduce((acc: any, r: any) => {
    acc.expected += Number(r.expected_amount || 0);
    acc.received += Number(r.received_amount || 0);
    acc.disbursed += Number(r.disbursed_amount || 0);
    return acc;
  }, { expected: 0, received: 0, disbursed: 0 });

  const exportCsv = () => {
    const headers = ["applicant", "loan_type", "lender", "agent", "disbursed_amount", "payout_pct", "expected_amount", "received_amount", "status", "invoice_no", "received_at", "created_at"];
    const out = rows.map((r: any) => ({
      applicant: r.loan_applications?.applicant_name, loan_type: r.loan_applications?.loan_type,
      lender: r.lenders?.name, agent: r.profiles?.full_name || r.profiles?.email,
      disbursed_amount: r.disbursed_amount, payout_pct: r.payout_pct,
      expected_amount: r.expected_amount, received_amount: r.received_amount,
      status: r.status, invoice_no: r.invoice_no, received_at: r.received_at, created_at: r.created_at,
    }));
    downloadCsv(`commissions-${Date.now()}.csv`, objectsToCsv(out as never, headers));
  };

  const inr = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const statusColor: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    invoiced: "bg-info/15 text-info",
    received: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
  };

  // Agent-wise summary
  const agents = Object.entries(rows.reduce((acc: any, r: any) => {
    const key = r.profiles?.full_name || r.profiles?.email || "Unassigned";
    if (!acc[key]) acc[key] = { expected: 0, received: 0, count: 0 };
    acc[key].expected += Number(r.expected_amount || 0);
    acc[key].received += Number(r.received_amount || 0);
    acc[key].count += 1;
    return acc;
  }, {})).map(([name, v]: [string, any]) => ({ name, ...v }));

  return (
    <div className="p-6 space-y-4">
      <div className="grid gap-4 grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><DollarSign className="h-3 w-3" />Total Disbursed</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{inr(totals.disbursed)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><TrendingUp className="h-3 w-3" />Expected Payout</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{inr(totals.expected)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center gap-2"><Wallet className="h-3 w-3" />Received Payout</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-success">{inr(totals.received)}</div></CardContent></Card>
      </div>

      {agents.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Agent-wise Earnings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Files</TableHead><TableHead>Expected</TableHead><TableHead>Received</TableHead><TableHead>Pending</TableHead></TableRow></TableHeader>
              <TableBody>{agents.map((a) => (
                <TableRow key={a.name}><TableCell className="font-medium">{a.name}</TableCell><TableCell>{a.count}</TableCell><TableCell>{inr(a.expected)}</TableCell><TableCell className="text-success">{inr(a.received)}</TableCell><TableCell className="text-warning">{inr(a.expected - a.received)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">All Payouts</h3>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Applicant</TableHead><TableHead>Lender</TableHead><TableHead>Agent</TableHead><TableHead>Disbursed</TableHead><TableHead>Payout %</TableHead><TableHead>Expected</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No commission rows yet. They appear automatically when applications reach "Disbursed".</TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.loan_applications?.applicant_name}<div className="text-[10px] text-muted-foreground capitalize">{r.loan_applications?.loan_type}</div></TableCell>
                  <TableCell className="text-sm">{r.lenders?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{r.profiles?.full_name || r.profiles?.email || "—"}</TableCell>
                  <TableCell className="text-sm">{inr(r.disbursed_amount)}</TableCell>
                  <TableCell className="text-sm">{r.payout_pct}%</TableCell>
                  <TableCell className="text-sm">{inr(r.expected_amount)}</TableCell>
                  <TableCell className="text-sm text-success">{inr(r.received_amount)}</TableCell>
                  <TableCell><Badge className={statusColor[r.status]}>{r.status}</Badge></TableCell>
                  {canEdit && <TableCell><Button size="sm" variant="ghost" onClick={() => { setEditing(r); setReceived(String(r.received_amount || "")); setInvoice(r.invoice_no || ""); }}>Update</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Payout</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Received Amount (₹)</Label><Input type="number" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
            <div><Label className="text-xs">Invoice No.</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Expected: {inr(editing?.expected_amount)}</p>
          </div>
          <DialogFooter><Button onClick={() => updateComm.mutate()} disabled={updateComm.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
