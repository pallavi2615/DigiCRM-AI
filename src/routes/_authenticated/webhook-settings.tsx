import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { updateWebhookRetryConfig } from "@/lib/webhook-retry.functions";

export const Route = createFileRoute("/_authenticated/webhook-settings")({
  head: () => ({ meta: [{ title: "Webhook Retry Settings — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="webhook-settings" label="Webhook Settings">
      <WebhookSettingsPage />
    </RoleGuard>
  ),
});

type Tenant = {
  id: string; name: string; slug: string;
  webhook_max_attempts: number; webhook_backoff_base_minutes: number; webhook_backoff_factor: number;
};

function preview(base: number, factor: number, max: number) {
  const rows: { attempt: number; minutes: number; cumulative: string }[] = [];
  let cum = 0;
  for (let i = 1; i <= max; i++) {
    const m = Math.max(1, Math.round(base * Math.pow(factor, i - 1)));
    cum += m;
    rows.push({ attempt: i, minutes: m, cumulative: cum >= 60 ? `${(cum / 60).toFixed(1)}h` : `${cum}m` });
  }
  return rows;
}

function TenantRow({ t }: { t: Tenant }) {
  const [max, setMax] = useState(t.webhook_max_attempts);
  const [base, setBase] = useState(t.webhook_backoff_base_minutes);
  const [factor, setFactor] = useState(Number(t.webhook_backoff_factor));
  const [saving, setSaving] = useState(false);
  const update = useServerFn(updateWebhookRetryConfig);
  useEffect(() => {
    setMax(t.webhook_max_attempts); setBase(t.webhook_backoff_base_minutes); setFactor(Number(t.webhook_backoff_factor));
  }, [t.id, t.webhook_max_attempts, t.webhook_backoff_base_minutes, t.webhook_backoff_factor]);

  const dirty = max !== t.webhook_max_attempts || base !== t.webhook_backoff_base_minutes || factor !== Number(t.webhook_backoff_factor);

  const save = async () => {
    setSaving(true);
    try {
      await update({ data: { tenantId: t.id, maxAttempts: max, baseMinutes: base, factor } });
      toast.success(`Saved for ${t.name}`);
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  const rows = preview(base, factor, max);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{t.name} <span className="text-xs text-muted-foreground font-normal">/{t.slug}</span></span>
          <Button size="sm" onClick={save} disabled={!dirty || saving}><Save className="h-3 w-3 mr-1" />{saving ? "Saving…" : "Save"}</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Max attempts (1–20)</Label>
            <Input type="number" min={1} max={20} value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Base delay (minutes, 1–1440)</Label>
            <Input type="number" min={1} max={1440} value={base} onChange={(e) => setBase(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Backoff factor (1–10)</Label>
            <Input type="number" step={0.1} min={1} max={10} value={factor} onChange={(e) => setFactor(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Schedule preview</Label>
          <div className="rounded border">
            <Table>
              <TableHeader><TableRow><TableHead>Attempt</TableHead><TableHead>Wait</TableHead><TableHead>Elapsed</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.attempt}>
                    <TableCell>#{r.attempt}</TableCell>
                    <TableCell>{r.minutes >= 60 ? `${(r.minutes / 60).toFixed(1)}h` : `${r.minutes}m`}</TableCell>
                    <TableCell className="text-muted-foreground">{r.cumulative}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WebhookSettingsPage() {
  const { isAdmin, loading } = useAuth();
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["webhook-settings-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants")
        .select("id, name, slug, webhook_max_attempts, webhook_backoff_base_minutes, webhook_backoff_factor")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
    enabled: isAdmin,
  });

  if (!loading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground mt-2">You don't have access to webhook retry settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Settings2 className="h-6 w-6" /> Webhook retry settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure retry attempts and exponential backoff per tenant. Retries stop after max attempts and move to the dead-letter queue.</p>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
        tenants.length === 0 ? <p className="text-sm text-muted-foreground">No tenants yet.</p> :
        <div className="grid gap-4">{tenants.map((t) => <TenantRow key={t.id} t={t} />)}</div>}
    </div>
  );
}
