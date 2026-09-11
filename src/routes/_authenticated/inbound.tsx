import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Webhook, Sheet, Facebook, Instagram, Copy, Plus, Loader2, Radio, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncSheetNowFn, exportToSheetFn } from "@/lib/sheets.functions";
import { useActiveTenant, useTenantWebhookSecret } from "@/lib/tenants";
import { FeatureGate } from "@/components/feature-gate";
import { useAllPacks } from "@/lib/pack-config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/inbound")({
  head: () => ({ meta: [{ title: "Inbound Leads — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: InboundPage,
});

function InboundPage() {
  const { active } = useActiveTenant();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Radio className="h-6 w-6" /> Inbound Lead Channels</h1>
        <p className="text-sm text-muted-foreground mt-1">Capture leads from webhooks, Google Sheets, and Facebook Lead Ads.</p>
      </div>

      {!active ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Select or create a tenant in Settings → Tenants to configure inbound channels.
        </CardContent></Card>
      ) : (
        <>
          <WebhookSection tenantId={active.id} tenantSlug={active.slug} />
          <FeatureGate feature="inbound.google_sheets">
            <SheetsSection tenantId={active.id} />
          </FeatureGate>
          <FeatureGate feature="inbound.facebook">
            <MetaSection tenantId={active.id} tenantSlug={active.slug} />
          </FeatureGate>
          <RecentIntakes tenantId={active.id} />
        </>
      )}
    </div>
  );
}

function WebhookSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { data: secret, isLoading } = useTenantWebhookSecret(tenantId);
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/public/inbound/leads/${tenantSlug}` : "";
  const displaySecret = secret ?? "";
  const example = secret ? `curl -X POST '${url}' \\
  -H 'content-type: application/json' \\
  -H 'x-webhook-secret: ${secret}' \\
  -d '{"name":"Jane Smith","email":"jane@example.com","phone":"+1 555-0123","source":"landing-form","message":"Interested in demo"}'` : "# Sign in as Super Admin or Admin to view the secret and example.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Public Webhook</CardTitle>
        <p className="text-xs text-muted-foreground">Drop this endpoint into any website form, Zapier, Make, or custom app.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Endpoint</Label>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-muted rounded p-2 break-all">{url}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Secret (send as <code>x-webhook-secret</code> header) — admin-only</Label>
          {isLoading ? (
            <div className="text-xs text-muted-foreground mt-1">Loading…</div>
          ) : secret ? (
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted rounded p-2 truncate">{displaySecret}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(displaySecret); toast.success("Copied"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic mt-1">
              Hidden — only Super Admin / Admin can reveal this webhook secret.
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs">Example</Label>
          <pre className="text-[11px] bg-muted rounded p-3 overflow-x-auto">{example}</pre>
        </div>
      </CardContent>
    </Card>
  );
}


function SheetsSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const syncNow = useServerFn(syncSheetNowFn);
  const exportSheet = useServerFn(exportToSheetFn);
  const [exportEntity, setExportEntity] = useState<"leads" | "contacts" | "companies">("leads");
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const { data: configs = [] } = useQuery({
    queryKey: ["sheet-configs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sheet_sync_configs").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { packs } = useAllPacks();
  const blank = { name: "", spreadsheet_id: "", range_a1: "Sheet1!A2:D", column_mapping: '{"contact_person":"A","email":"B","phone":"C","notes":"D"}', packKey: "" };
  const [form, setForm] = useState(blank);
  const add = useMutation({
    mutationFn: async () => {
      let mapping = {};
      try { mapping = JSON.parse(form.column_mapping); } catch { throw new Error("Invalid JSON mapping"); }
      const [group, slug] = form.packKey ? form.packKey.split("::") : [null, null];
      const { error } = await supabase.from("sheet_sync_configs").insert({
        tenant_id: tenantId, name: form.name, spreadsheet_id: form.spreadsheet_id,
        range_a1: form.range_a1, column_mapping: mapping, is_enabled: true,
        group_slug: group, pack_slug: slug,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Sheet config added"); qc.invalidateQueries({ queryKey: ["sheet-configs"] }); setForm(blank); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runSync = useMutation({
    mutationFn: async (configId: string) => syncNow({ data: { configId } }),
    onSuccess: (r: { inserted: number; scanned: number }) => {
      toast.success(`Imported ${r.inserted} of ${r.scanned} rows`);
      qc.invalidateQueries({ queryKey: ["sheet-configs"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runExport = useMutation({
    mutationFn: async () => exportSheet({ data: { entity: exportEntity } }),
    onSuccess: (r: { url: string; rows: number }) => {
      setExportUrl(r.url);
      toast.success(`Exported ${r.rows} rows to Google Sheets`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Sheet className="h-4 w-4" /> Google Sheets Sync &amp; Export</CardTitle>
        <p className="text-xs text-muted-foreground">Link a Google Sheet to import leads, or push CRM data straight into a new spreadsheet.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Spreadsheet ID</Label><Input value={form.spreadsheet_id} onChange={(e) => setForm({ ...form, spreadsheet_id: e.target.value })} placeholder="1AbC…" /></div>
          <div><Label>Range (A1)</Label><Input value={form.range_a1} onChange={(e) => setForm({ ...form, range_a1: e.target.value })} /></div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Column mapping (JSON)</Label>
            <Textarea rows={3} className="font-mono text-xs" value={form.column_mapping} onChange={(e) => setForm({ ...form, column_mapping: e.target.value })} />
          </div>
          <div>
            <Label>Open these leads in</Label>
            <Select value={form.packKey} onValueChange={(v) => setForm({ ...form, packKey: v })}>
              <SelectTrigger><SelectValue placeholder="Choose the pack pipeline" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {packs.map((p) => (
                  <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>{p.groupName} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Every imported row also opens a file at the first stage of this pack.
            </p>
          </div>
        </div>
        <Button onClick={() => add.mutate()} disabled={!form.name || !form.spreadsheet_id || add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Add sheet
        </Button>
        {configs.length > 0 && (
          <div className="border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Pack</TableHead><TableHead>Spreadsheet</TableHead><TableHead>Range</TableHead><TableHead>Last run</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-xs">
                      {packs.find((p) => p.group === c.group_slug && p.slug === c.pack_slug)?.name ?? "Leads only"}
                    </TableCell>
                    <TableCell className="text-xs font-mono max-w-[220px] truncate">{c.spreadsheet_id}</TableCell>
                    <TableCell className="text-xs">{c.range_a1}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.last_run_at ? new Date(c.last_run_at).toLocaleString() : "—"}</TableCell>
                    <TableCell><Badge variant={c.is_enabled ? "default" : "outline"}>{c.last_status ?? (c.is_enabled ? "Active" : "Paused")}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => runSync.mutate(c.id)} disabled={runSync.isPending}>
                        {runSync.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        <span className="ml-1">Sync now</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-md border p-3 space-y-3">
          <Label className="text-xs">Export CRM data to a new Google Sheet</Label>
          <div className="flex flex-wrap items-center gap-2">
            {(["leads", "contacts", "companies"] as const).map((e) => (
              <Button key={e} size="sm" variant={exportEntity === e ? "default" : "outline"} onClick={() => setExportEntity(e)} className="capitalize">
                {e}
              </Button>
            ))}
            <Button size="sm" onClick={() => runExport.mutate()} disabled={runExport.isPending}>
              {runExport.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />} Export to Google Sheets
            </Button>
          </div>
          {exportUrl && (
            <a href={exportUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline break-all">{exportUrl}</a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetaSection({ tenantId, tenantSlug }: { tenantId: string; tenantSlug: string }) {
  const { data: secret } = useTenantWebhookSecret(tenantId);
  const { packs } = useAllPacks();
  const [packKey, setPackKey] = useState("");
  const [group, slug] = packKey ? packKey.split("::") : [null, null];
  const base = typeof window !== "undefined" ? `${window.location.origin}/api/public/inbound/meta/${tenantSlug}` : "";
  const url = base && group && slug ? `${base}?group=${group}&pack=${slug}` : base;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Facebook className="h-4 w-4" /> <Instagram className="h-4 w-4" /> Facebook &amp; Instagram Lead Ads
        </CardTitle>
        <p className="text-xs text-muted-foreground">Live endpoint for Meta Lead Ads webhooks — Facebook Pages and Instagram lead forms both post here.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <Label className="text-xs">Open these leads in</Label>
          <Select value={packKey} onValueChange={setPackKey}>
            <SelectTrigger><SelectValue placeholder="Choose the pack pipeline" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {packs.map((p) => (
                <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>{p.groupName} — {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Callback URL</Label>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-muted rounded p-2 break-all">{url}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Verify token / secret (admin-only)</Label>
          {secret ? (
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted rounded p-2 truncate">{secret}</code>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(secret); toast.success("Copied"); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic mt-1">Hidden — only Super Admin / Admin can reveal it.</p>
          )}
        </div>
        <ol className="list-decimal list-inside text-xs space-y-1 text-muted-foreground">
          <li>Meta App → Webhooks → Page (and Instagram) → paste the callback URL and verify token above.</li>
          <li>Subscribe to the <code>leadgen</code> field and connect your Page / Instagram professional account.</li>
          <li>Forward with <code>?token=&lt;verify token&gt;</code> or an <code>x-webhook-secret</code> header when relaying via Zapier or Make.</li>
        </ol>
        <p className="text-xs text-muted-foreground">Leads land in Leads with source “Facebook Lead Ads” or “Instagram Lead Ads”, and every call is logged below.</p>
      </CardContent>
    </Card>
  );
}


function RecentIntakes({ tenantId }: { tenantId: string }) {
  const { data: logs = [] } = useQuery({
    queryKey: ["inbound-log", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("inbound_webhooks_log")
        .select("id, source, ok, status_code, message, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!logs.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Recent inbound events</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{l.source}</Badge></TableCell>
                <TableCell>
                  <Badge className={l.ok ? "bg-green-500/20 text-green-600" : "bg-destructive/20 text-destructive"}>
                    {l.ok ? "ok" : `${l.status_code}`}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">
                  {l.message ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
