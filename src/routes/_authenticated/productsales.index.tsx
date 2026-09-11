import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Package, FileText, CheckCircle2, Coins, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/productsales/")({
  component: ProductSalesDashboard,
});

function ProductSalesDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["ps-dashboard"],
    queryFn: async () => {
      const [products, orders, commissions] = await Promise.all([
        (supabase as any).from("ps_products").select("id, active, stock"),
        (supabase as any).from("ps_orders").select("id, status, total"),
        (supabase as any).from("ps_commissions").select("id, commission_amount, status"),
      ]);
      const p = products.data || [];
      const o = orders.data || [];
      const c = commissions.data || [];
      return {
        activeProducts: p.filter((x: any) => x.active).length,
        lowStock: p.filter((x: any) => x.stock < 10).length,
        openQuotes: o.filter((x: any) => ["draft", "sent"].includes(x.status)).length,
        confirmedRevenue: o.filter((x: any) => ["confirmed", "fulfilled"].includes(x.status)).reduce((s: number, x: any) => s + Number(x.total || 0), 0),
        pendingCommission: c.filter((x: any) => x.status === "pending").reduce((s: number, x: any) => s + Number(x.commission_amount || 0), 0),
        paidCommission: c.filter((x: any) => x.status === "paid").reduce((s: number, x: any) => s + Number(x.commission_amount || 0), 0),
      };
    },
  });

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const cards = [
    { label: "Active Products", value: data?.activeProducts ?? 0, icon: Package, hint: `${data?.lowStock ?? 0} low stock` },
    { label: "Open Quotes", value: data?.openQuotes ?? 0, icon: FileText, hint: "Draft or sent" },
    { label: "Confirmed Revenue", value: `₹${(data?.confirmedRevenue ?? 0).toLocaleString()}`, icon: CheckCircle2, hint: "Confirmed & fulfilled" },
    { label: "Commission (Pending)", value: `₹${(data?.pendingCommission ?? 0).toLocaleString()}`, icon: Coins, hint: `₹${(data?.paidCommission ?? 0).toLocaleString()} paid` },
  ];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Overview</h2>
        <p className="text-sm text-muted-foreground">Catalog, orders and commissions at a glance</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className="text-2xl font-bold mt-1">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
