import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Users, DollarSign, TrendingUp, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/affiliates_/$id/referrals")({
  head: () => ({ meta: [{ title: "Affiliate Referrals — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: AffiliateReferrals,
});

type Affiliate = {
  id: string; name: string; email: string; referral_code: string | null;
  commission_pct: number; status: string; user_id: string | null;
};
type ReferredLead = {
  id: string; company_name: string; contact_person: string | null; email: string | null;
  status: string; estimated_value: number | null; converted_at: string | null; created_at: string;
};
type Commission = {
  id: string; base_amount: number; commission_pct: number; commission_amount: number;
  status: string; created_at: string; lead_id: string | null;
};

function AffiliateReferrals() {
  const { id } = Route.useParams();
  const { isAdmin, user, loading } = useAuth();

  const { data: aff } = useQuery({
    queryKey: ["affiliate", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("affiliates")
        .select("id, name, email, referral_code, commission_pct, status, user_id")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Affiliate | null;
    },
  });

  const canView = isAdmin || (aff && aff.user_id === user?.id);

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["aff-leads", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads")
        .select("id, company_name, contact_person, email, status, estimated_value, converted_at, created_at")
        .eq("affiliate_id", id)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as ReferredLead[];
    },
    enabled: !!aff && !!canView,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["aff-commissions", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("affiliate_commissions")
        .select("id, base_amount, commission_pct, commission_amount, status, created_at, lead_id")
        .eq("affiliate_id", id)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Commission[];
    },
    enabled: !!aff && !!canView,
  });

  const stats = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter((l) => l.converted_at || l.status === "won" || l.status === "converted").length;
    const pipelineValue = leads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);
    const earned = commissions.filter((c) => c.status !== "void").reduce((s, c) => s + Number(c.commission_amount), 0);
    const paid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount), 0);
    return {
      total, converted,
      conversionRate: total > 0 ? (converted / total) * 100 : 0,
      pipelineValue, earned, paid,
    };
  }, [leads, commissions]);

  if (loading) return <div className="p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (aff && !canView) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-sm text-muted-foreground mt-2">You can only view your own referrals.</p>
      </div>
    );
  }
  if (!aff) return <div className="p-12 text-center text-muted-foreground">Affiliate not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/affiliates"><ArrowLeft className="h-4 w-4 mr-1" /> Affiliates</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Users className="h-6 w-6" /> {aff.name}
        </h1>
        <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span>{aff.email}</span>
          {aff.referral_code && <span>Code: <code className="text-xs bg-muted px-1 py-0.5 rounded">{aff.referral_code}</code></span>}
          <span>Commission: {aff.commission_pct}%</span>
          <Badge variant="outline">{aff.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Referred" value={stats.total} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Converted" value={stats.converted} icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi label="Conv. rate" value={`${stats.conversionRate.toFixed(1)}%`} />
        <Kpi label="Earned" value={`$${stats.earned.toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} />
        <Kpi label="Paid out" value={`$${stats.paid.toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Referred leads</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Converted</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center"><Loader2 className="h-4 w-4 inline animate-spin" /></TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No referred leads yet.</TableCell></TableRow>
                ) : leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.company_name}</TableCell>
                    <TableCell>{l.contact_person ?? "—"}<div className="text-xs text-muted-foreground">{l.email}</div></TableCell>
                    <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                    <TableCell>{l.estimated_value ? `$${Number(l.estimated_value).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-xs">{l.converted_at ? new Date(l.converted_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Commissions</CardTitle></CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commissions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>${Number(c.base_amount).toFixed(2)}</TableCell>
                    <TableCell>{c.commission_pct}%</TableCell>
                    <TableCell className="font-medium">${Number(c.commission_amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
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

function Kpi({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase text-muted-foreground">{label}</div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}
