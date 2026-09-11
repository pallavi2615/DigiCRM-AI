import { RoleGuard, SUPER_ONLY } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Crown, Sparkles, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/settings-plans")({
  head: () => ({ meta: [{ title: "Plans & Features — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={SUPER_ONLY} module="settings-plans" label="PLANS">
      <SettingsPlans />
    </RoleGuard>
  ),
});

type Row = {
  id: string;
  plan: "lite" | "prime";
  feature_key: string;
  enabled: boolean;
  numeric_limit: number | null;
  description: string | null;
};

function SettingsPlans() {
  const { roles } = useAuth();
  const isSuper = roles.includes("super_admin");
  const qc = useQueryClient();

  const { data: features = [], isLoading } = useQuery({
    queryKey: ["plan-features-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_features")
        .select("id, plan, feature_key, enabled, numeric_limit, description")
        .order("feature_key");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const grouped = useMemo(() => {
    const byKey: Record<string, { lite?: Row; prime?: Row; description?: string | null }> = {};
    for (const r of features) {
      byKey[r.feature_key] ??= { description: r.description };
      byKey[r.feature_key][r.plan] = r;
      if (r.description) byKey[r.feature_key].description = r.description;
    }
    return byKey;
  }, [features]);

  const update = useMutation({
    mutationFn: async (patch: { id: string; enabled?: boolean; numeric_limit?: number | null }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("plan_features").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["plan-features-admin"] }); qc.invalidateQueries({ queryKey: ["plan-features"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuper) {
    return (
      <Card><CardContent className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h2 className="font-semibold">Super Admin only</h2>
        <p className="text-sm text-muted-foreground mt-1">Plan & feature configuration is restricted.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plans & Features</h1>
        <p className="text-sm text-muted-foreground mt-1">Control what Lite and Prime tenants get.</p>
      </div>

      {isLoading ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Feature matrix</span>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Lite</span>
                <span className="flex items-center gap-1"><Crown className="h-3 w-3 text-amber-500" /> Prime</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {Object.keys(grouped).sort().map((key) => {
                const g = grouped[key];
                return (
                  <div key={key} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-center">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{key}</div>
                      <div className="text-sm mt-0.5">{g.description || "—"}</div>
                    </div>
                    <PlanCell row={g.lite} onToggle={(v) => g.lite && update.mutate({ id: g.lite.id, enabled: v })}
                      onLimit={(n) => g.lite && update.mutate({ id: g.lite.id, numeric_limit: n })} label="Lite" />
                    <PlanCell row={g.prime} onToggle={(v) => g.prime && update.mutate({ id: g.prime.id, enabled: v })}
                      onLimit={(n) => g.prime && update.mutate({ id: g.prime.id, numeric_limit: n })} label="Prime" prime />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanCell({ row, onToggle, onLimit, label, prime }: {
  row?: Row; onToggle: (v: boolean) => void; onLimit: (n: number | null) => void; label: string; prime?: boolean;
}) {
  if (!row) return <div className="text-xs text-muted-foreground w-[140px]">—</div>;
  return (
    <div className="flex items-center gap-2 min-w-[220px] justify-end">
      <Badge variant={prime ? "default" : "outline"} className="text-[10px]">{label}</Badge>
      <Switch checked={row.enabled} onCheckedChange={onToggle} />
      <Input
        type="number"
        placeholder="∞"
        className="w-20 h-8"
        value={row.numeric_limit ?? ""}
        onChange={(e) => onLimit(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}
