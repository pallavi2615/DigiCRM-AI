import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/webhook-settings")({
  head: () => ({ meta: [{ title: "Webhook Retry Settings — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="webhook-settings" label="Webhook Settings">
      <WebhookSettingsPage />
    </RoleGuard>
  ),
});

// ---------------------------------------------------------------------
// API layer — talks to the FastAPI webhook-settings router
// ---------------------------------------------------------------------

const API_BASE = "/api/v1/webhook-settings";

type RetrySetting = {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_subdomain: string;
  max_attempts: number;
  base_delay_minutes: number;
  backoff_factor: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type RetrySettingUpdate = {
  max_attempts: number;
  base_delay_minutes: number;
  backoff_factor: number;
  enabled: boolean;
};

function fetchRetrySettings(): Promise<RetrySetting[]> {
  return apiFetch<RetrySetting[]>(`${API_BASE}/retry`);
}

function saveRetrySettings(tenantId: number, payload: RetrySettingUpdate): Promise<RetrySetting> {
  return apiFetch<RetrySetting>(`${API_BASE}/retry/${tenantId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------
// Backoff schedule preview
// ---------------------------------------------------------------------

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

// ---------------------------------------------------------------------
// Tenant row / card
// ---------------------------------------------------------------------

function TenantRow({ t }: { t: RetrySetting }) {
  const queryClient = useQueryClient();
  const [max, setMax] = useState(t.max_attempts);
  const [base, setBase] = useState(t.base_delay_minutes);
  const [factor, setFactor] = useState(Number(t.backoff_factor));

  useEffect(() => {
    setMax(t.max_attempts);
    setBase(t.base_delay_minutes);
    setFactor(Number(t.backoff_factor));
  }, [t.id, t.max_attempts, t.base_delay_minutes, t.backoff_factor]);

  const dirty =
    max !== t.max_attempts || base !== t.base_delay_minutes || factor !== Number(t.backoff_factor);

  const mutation = useMutation({
    mutationFn: (payload: RetrySettingUpdate) => saveRetrySettings(t.tenant_id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<RetrySetting[]>(["webhook-settings-tenants"], (old) =>
        old?.map((row) => (row.id === updated.id ? updated : row)) ?? old
      );
      toast.success(`Saved for ${t.tenant_name}`);
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Save failed");
    },
  });

  const save = () => {
    mutation.mutate({
      max_attempts: max,
      base_delay_minutes: base,
      backoff_factor: factor,
      enabled: t.enabled,
    });
  };

  const rows = preview(base, factor, max);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>
            {t.tenant_name}{" "}
            <span className="text-xs text-muted-foreground font-normal">/{t.tenant_subdomain}</span>
          </span>
          <Button size="sm" onClick={save} disabled={!dirty || mutation.isPending}>
            <Save className="h-3 w-3 mr-1" />
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
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
            <Input
              type="number"
              min={1}
              max={1440}
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Backoff factor (1–10)</Label>
            <Input
              type="number"
              step={0.1}
              min={1}
              max={10}
              value={factor}
              onChange={(e) => setFactor(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Schedule preview</Label>
          <div className="rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Wait</TableHead>
                  <TableHead>Elapsed</TableHead>
                </TableRow>
              </TableHeader>
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

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------

function WebhookSettingsPage() {
  const { isAdmin, loading } = useAuth();
  const {
    data: tenants = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["webhook-settings-tenants"],
    queryFn: fetchRetrySettings,
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
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Settings2 className="h-6 w-6" /> Webhook retry settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure retry attempts and exponential backoff per tenant. Retries stop after max attempts and move to
          the dead-letter queue.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tenants yet.</p>
      ) : (
        <div className="grid gap-4">
          {tenants.map((t) => (
            <TenantRow key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}