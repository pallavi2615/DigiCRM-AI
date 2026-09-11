import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Percent, Save } from "lucide-react";

type Settings = {
  default_commission_pct: number;
  cookie_days: number;
  payout_terms: string | null;
};

/** Programme-wide affiliate settings: default commission, cookie window, payout terms. */
export function AffiliateSettingsCard() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_settings")
        .select("default_commission_pct, cookie_days, payout_terms")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      return (data as Settings | null) ?? { default_commission_pct: 20, cookie_days: 60, payout_terms: "" };
    },
  });

  const [form, setForm] = useState<Settings>({ default_commission_pct: 20, cookie_days: 60, payout_terms: "" });
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("affiliate_settings")
        .update({
          default_commission_pct: Number(form.default_commission_pct),
          cookie_days: Number(form.cookie_days),
          payout_terms: form.payout_terms,
        })
        .eq("id", "default");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Affiliate settings saved");
      qc.invalidateQueries({ queryKey: ["affiliate-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Percent className="h-4 w-4" />Programme settings</CardTitle>
        <CardDescription>
          New partners start on the default commission. Referral links (<code>?ref=CODE</code>) are attributed for the cookie window,
          and a commission is created automatically when a referred lead is won.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[160px_160px_1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label>Default commission %</Label>
          <Input type="number" min={0} max={100} step="0.5" disabled={!isAdmin || isLoading}
            value={form.default_commission_pct}
            onChange={(e) => setForm({ ...form, default_commission_pct: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Cookie window (days)</Label>
          <Input type="number" min={1} max={365} disabled={!isAdmin || isLoading}
            value={form.cookie_days}
            onChange={(e) => setForm({ ...form, cookie_days: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Payout terms</Label>
          <Textarea rows={2} disabled={!isAdmin || isLoading}
            value={form.payout_terms ?? ""}
            onChange={(e) => setForm({ ...form, payout_terms: e.target.value })} />
        </div>
        <Button onClick={() => save.mutate()} disabled={!isAdmin || save.isPending}>
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}
