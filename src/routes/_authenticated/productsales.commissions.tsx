import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/productsales/commissions")({
  component: CommissionsPage,
});

function CommissionsPage() {
  const qc = useQueryClient();
  const { isManager, isAdmin } = useAuth();
  const canApprove = isManager || isAdmin;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ps-commissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ps_commissions")
        .select("*, ps_orders(order_no, customer_name, total), profiles!ps_commissions_user_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) {
        // fallback without profiles join
        const { data: d2 } = await (supabase as any).from("ps_commissions").select("*, ps_orders(order_no, customer_name, total)").order("created_at", { ascending: false });
        return d2 || [];
      }
      return data;
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("ps_commissions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["ps-commissions"] });
  };

  const totals = rows.reduce((acc: any, r: any) => {
    acc.pending += r.status === "pending" ? Number(r.commission_amount) : 0;
    acc.approved += r.status === "approved" ? Number(r.commission_amount) : 0;
    acc.paid += r.status === "paid" ? Number(r.commission_amount) : 0;
    return acc;
  }, { pending: 0, approved: 0, paid: 0 });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Commissions</h2>
        <p className="text-sm text-muted-foreground">Auto-calculated when an order is confirmed</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold">₹{totals.pending.toLocaleString()}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Approved</p><p className="text-2xl font-bold">₹{totals.approved.toLocaleString()}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Paid</p><p className="text-2xl font-bold">₹{totals.paid.toLocaleString()}</p></Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Beneficiary</TableHead>
              <TableHead>Base</TableHead><TableHead>%</TableHead><TableHead>Commission</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No commissions yet — confirm an order to generate one.</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.ps_orders?.order_no || "—"}</TableCell>
                <TableCell>{r.ps_orders?.customer_name || "—"}</TableCell>
                <TableCell className="text-xs">{r.profiles?.full_name || r.profiles?.email || r.user_id.substring(0, 8)}</TableCell>
                <TableCell>₹{Number(r.base_amount).toLocaleString()}</TableCell>
                <TableCell>{r.commission_pct}%</TableCell>
                <TableCell className="font-medium">₹{Number(r.commission_amount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "paid" ? "default" : r.status === "approved" ? "secondary" : "outline"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {canApprove && r.status === "pending" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "approved")}>Approve</Button>}
                  {canApprove && r.status === "approved" && <Button size="sm" onClick={() => setStatus(r.id, "paid")}>Mark Paid</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
