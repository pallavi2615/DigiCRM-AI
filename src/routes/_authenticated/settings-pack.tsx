import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffGuard } from "@/components/staff-guard";
import { useActiveTenant } from "@/lib/queries/tenants";   
import { INDUSTRY_PACKS, type IndustryPack, type PackAgent, type PackField, type PackFieldType } from "@/lib/industry-packs";
import { mergePack, type PackOverride } from "@/lib/pack-merge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDown, ArrowUp, Building2, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { PackAiTraining } from "@/components/pack-ai-training";

export const Route = createFileRoute("/_authenticated/settings-pack")({
  head: () => ({
    meta: [
      { title: "Workspace Pack Settings | DigiCRM AI" },
      { name: "description", content: "Tailor pipeline stages, terminology, custom fields and AI agent prompts for your own workspace, without changing anyone else's." },
      { property: "og:title", content: "Workspace Pack Settings | DigiCRM AI" },
      { property: "og:description", content: "Per-workspace stages, fields and AI prompts for every industry pack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <StaffGuard>
      <TenantPackSettings />
    </StaffGuard>
  ),
});

const FIELD_TYPES: PackFieldType[] = ["text", "number", "date", "select", "textarea"];

const SELECT_COLS =
  "group_slug, pack_slug, record_label, record_label_plural, party_label, value_label, stages, won_stages, lost_stages, fields, agents, name, tagline, description, gradient, kpi_labels, verifications, is_custom, archived_at";

function TenantPackSettings() {
  const { active, loading } = useActiveTenant();
  const qc = useQueryClient();
  const [key, setKey] = useState(`${INDUSTRY_PACKS[0]!.group}::${INDUSTRY_PACKS[0]!.slug}`);
  const [group, slug] = key.split("::") as [string, string];
  const base = useMemo(
    () => INDUSTRY_PACKS.find((p) => p.group === group && p.slug === slug) ?? INDUSTRY_PACKS[0]!,
    [group, slug],
  );

  const tenantId = active?.id ?? null;
  const { data: row, isLoading } = useQuery({
    queryKey: ["tenant-pack-config", tenantId, group, slug],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_configs")
        .select(SELECT_COLS)
        .eq("tenant_id", String(tenantId))
        .eq("group_slug", group)
        .eq("pack_slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PackOverride | null) ?? null;
    },
  });

  const [draft, setDraft] = useState<IndustryPack>(base);
  useEffect(() => {
    if (isLoading) return;
    setDraft(mergePack(base, row));
  }, [base, row, isLoading]);

  const save = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("Pick a workspace first");
      const { data: auth } = await supabase.auth.getUser();
      const payload = {
        tenant_id: tenantId,
        group_slug: draft.group,
        pack_slug: draft.slug,
        name: draft.name,
        tagline: draft.tagline,
        record_label: draft.recordLabel,
        record_label_plural: draft.recordLabelPlural,
        party_label: draft.partyLabel,
        value_label: draft.valueLabel,
        stages: draft.stages,
        won_stages: draft.wonStages,
        lost_stages: draft.lostStages,
        kpi_labels: draft.kpiLabels,
        verifications: draft.verifications,
        fields: draft.fields,
        agents: draft.agents,
        is_custom: false,
        archived_at: null,
        updated_by: auth.user?.id ?? null,
      };
      const { data: existing } = await supabase
        .from("pack_configs")
        .select("id")
        .eq("tenant_id", String(tenantId))
        .eq("group_slug", group)
        .eq("pack_slug", slug)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("pack_configs").update(payload as never).eq("id", (existing as { id: string }).id)
        : await supabase.from("pack_configs").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved for this workspace");
      qc.invalidateQueries({ queryKey: ["tenant-pack-config"] });
      qc.invalidateQueries({ queryKey: ["pack-config", group, slug] });
      qc.invalidateQueries({ queryKey: ["pack-configs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const { error } = await supabase
        .from("pack_configs")
        .delete()
        .eq("tenant_id", String(tenantId))
        .eq("group_slug", group)
        .eq("pack_slug", slug);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Back to the standard setup");
      qc.invalidateQueries({ queryKey: ["tenant-pack-config"] });
      qc.invalidateQueries({ queryKey: ["pack-config", group, slug] });
      qc.invalidateQueries({ queryKey: ["pack-configs"] });
      setDraft(base);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const stages = [...d.stages];
      const j = i + dir;
      if (j < 0 || j >= stages.length) return d;
      [stages[i], stages[j]] = [stages[j]!, stages[i]!];
      return { ...d, stages };
    });

  const renameStage = (i: number, value: string) =>
    setDraft((d) => {
      const old = d.stages[i]!;
      return {
        ...d,
        stages: d.stages.map((s, idx) => (idx === i ? value : s)),
        wonStages: d.wonStages.map((s) => (s === old ? value : s)),
        lostStages: d.lostStages.map((s) => (s === old ? value : s)),
      };
    });

  const toggle = (list: "wonStages" | "lostStages", stage: string) =>
    setDraft((d) => ({
      ...d,
      [list]: d[list].includes(stage) ? d[list].filter((s) => s !== stage) : [...d[list], stage],
    }));

  const patchField = (i: number, patch: Partial<PackField>) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) }));
  const patchAgent = (i: number, patch: Partial<PackAgent>) =>
    setDraft((d) => ({ ...d, agents: d.agents.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));

  if (loading) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;

  if (!active) {
    return (
      <Card className="m-4"><CardContent className="p-10 text-center space-y-3">
        <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You are not part of a workspace yet.</p>
        <Button asChild variant="outline"><Link to="/settings-tenants">Manage workspaces</Link></Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pack settings — {active.name}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Rename things, reshape the pipeline, add your own fields and rewrite the AI prompts. These changes apply to
            {" "}<strong>{active.name}</strong> only — other workspaces keep the standard setup.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending || !row}>
            <RotateCcw className="mr-2 h-4 w-4" />Use standard setup
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Industry pack</CardTitle>
          <CardDescription>{row ? "Customised for this workspace." : "Currently using the standard setup."}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={key} onValueChange={setKey}>
            <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              {INDUSTRY_PACKS.map((p) => (
                <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>
                  {p.groupName} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="basics">
        <TabsList>
          <TabsTrigger value="basics">Basics & stages</TabsTrigger>
          <TabsTrigger value="fields">Fields ({draft.fields.length})</TabsTrigger>
          <TabsTrigger value="agents">AI prompts ({draft.agents.length})</TabsTrigger>
          <TabsTrigger value="preview">Live preview</TabsTrigger>
          <TabsTrigger value="training">Assistant training</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Wording</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Pack name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Tagline</Label>
                <Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Record label</Label>
                <Input value={draft.recordLabel} onChange={(e) => setDraft({ ...draft, recordLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Record label (plural)</Label>
                <Input value={draft.recordLabelPlural} onChange={(e) => setDraft({ ...draft, recordLabelPlural: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Customer label</Label>
                <Input value={draft.partyLabel} onChange={(e) => setDraft({ ...draft, partyLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5"><Label>Value label</Label>
                <Input value={draft.valueLabel} onChange={(e) => setDraft({ ...draft, valueLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>KPI labels (comma separated)</Label>
                <Input
                  value={draft.kpiLabels.join(", ")}
                  onChange={(e) => setDraft({ ...draft, kpiLabels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pipeline stages</CardTitle>
              <CardDescription>Reorder with the arrows, then mark which stages count as won or lost.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {draft.stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                    <Input value={s} onChange={(e) => renameStage(i, e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => moveStage(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => moveStage(i, 1)} disabled={i === draft.stages.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDraft((d) => ({
                      ...d,
                      stages: d.stages.filter((_, idx) => idx !== i),
                      wonStages: d.wonStages.filter((x) => x !== s),
                      lostStages: d.lostStages.filter((x) => x !== s),
                    }))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, stages: [...d.stages, `Stage ${d.stages.length + 1}`] }))}>
                  <Plus className="mr-2 h-4 w-4" />Add stage
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Stages that count as won</Label>
                <div className="flex flex-wrap gap-2">
                  {draft.stages.map((s) => (
                    <Badge key={s} variant={draft.wonStages.includes(s) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggle("wonStages", s)}>{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stages that count as lost</Label>
                <div className="flex flex-wrap gap-2">
                  {draft.stages.map((s) => (
                    <Badge key={s} variant={draft.lostStages.includes(s) ? "destructive" : "outline"} className="cursor-pointer" onClick={() => toggle("lostStages", s)}>{s}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="mt-4 space-y-3">
          {draft.fields.map((f, i) => (
            <Card key={i}>
              <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_160px_1fr_auto]">
                <div className="space-y-1.5"><Label className="text-xs">Key</Label>
                  <Input value={f.key} onChange={(e) => patchField(i, { key: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Label</Label>
                  <Input value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Type</Label>
                  <Select value={f.type} onValueChange={(v) => patchField(i, { type: v as PackFieldType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Options (comma separated)</Label>
                  <Input
                    value={(f.options ?? []).join(", ")}
                    placeholder={f.type === "select" ? "Option A, Option B" : "—"}
                    onChange={(e) => patchField(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                  />
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="icon" onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((_, idx) => idx !== i) }))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => setDraft((d) => ({ ...d, fields: [...d.fields, { key: `field_${d.fields.length + 1}`, label: "New field", type: "text" }] }))}>
            <Plus className="mr-2 h-4 w-4" />Add field
          </Button>
        </TabsContent>

        <TabsContent value="agents" className="mt-4 space-y-3">
          {draft.agents.map((a, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
                  <div className="space-y-1.5"><Label className="text-xs">Key</Label>
                    <Input value={a.key} onChange={(e) => patchAgent(i, { key: e.target.value })} />
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Name</Label>
                    <Input value={a.label} onChange={(e) => patchAgent(i, { label: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="icon" onClick={() => setDraft((d) => ({ ...d, agents: d.agents.filter((_, idx) => idx !== i) }))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Short description</Label>
                  <Input value={a.description} onChange={(e) => patchAgent(i, { description: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Prompt / instruction</Label>
                  <Textarea rows={3} value={a.instruction} onChange={(e) => patchAgent(i, { instruction: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() => setDraft((d) => ({
              ...d,
              agents: [...d.agents, { key: `agent_${d.agents.length + 1}`, label: "New agent", description: "", instruction: "" }],
            }))}
          >
            <Plus className="mr-2 h-4 w-4" />Add AI agent
          </Button>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <PackLivePreview pack={draft} tenantName={active.name} />
        </TabsContent>

        <TabsContent value="training" className="mt-4">
          <PackAiTraining tenantId={active.id} group={group} slug={slug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Shows how the unsaved draft will look in the pipeline board and the client portal. */
function PackLivePreview({ pack, tenantName }: { pack: IndustryPack; tenantName: string }) {
  const sample = [`Acme ${pack.partyLabel}`, `Northwind ${pack.partyLabel}`, `Blue Ridge ${pack.partyLabel}`];
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline board</CardTitle>
          <CardDescription>
            {pack.recordLabelPlural} move left to right through these stages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {pack.stages.map((stage, i) => (
              <div key={`${stage}-${i}`} className="min-w-42.5 flex-1 rounded-lg border bg-muted/30 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">{stage}</span>
                  {pack.wonStages.includes(stage) && <Badge className="text-[10px]">won</Badge>}
                  {pack.lostStages.includes(stage) && <Badge variant="destructive" className="text-[10px]">lost</Badge>}
                </div>
                {i < sample.length ? (
                  <div className="rounded-md border bg-background p-2">
                    <div className="truncate text-xs font-medium">{sample[i]}</div>
                    <div className="text-[11px] text-muted-foreground">{pack.valueLabel}: ₹{(i + 3) * 250000}</div>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
                    No {pack.recordLabelPlural.toLowerCase()} yet
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pack.kpiLabels.map((k) => (
              <div key={k} className="rounded-md border px-3 py-1.5 text-xs">
                <div className="text-muted-foreground">{k}</div>
                <div className="font-semibold">—</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Client portal</CardTitle>
          <CardDescription>What a {pack.partyLabel.toLowerCase()} of {tenantName} sees when they sign in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={"rounded-lg bg-linear-to-r from-primary to-primary/60 p-4 text-primary-foreground"}>
            <div className="text-sm font-semibold">{pack.name}</div>
            <div className="text-xs opacity-90">{pack.tagline}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-semibold">Your {pack.recordLabel.toLowerCase()}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {pack.fields.slice(0, 6).map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">{f.label}</div>
                  <div className="h-8 rounded-md border bg-muted/40" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-semibold">AI helpers available in this workspace</div>
            <div className="flex flex-wrap gap-2">
              {pack.agents.length === 0 && <span className="text-xs text-muted-foreground">None configured yet.</span>}
              {pack.agents.map((a) => (
                <Badge key={a.key} variant="secondary" className="text-[11px]">{a.label}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}