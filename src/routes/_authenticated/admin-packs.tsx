import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/role-guard";
import {
  INDUSTRY_PACKS,
  PACK_GROUPS,
  VERIFICATION_LABELS,
  type IndustryPack,
  type PackAgent,
  type PackField,
  type PackFieldType,
  type VerificationKind,
} from "@/lib/industry-packs";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { usePackConfigs, usePackOverride, applyConfigs } from "@/lib/pack-config";
import { mergePack, packFromRow } from "@/lib/pack-merge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowDown, ArrowUp, Archive, Copy, Loader2, Plus, RotateCcw, Save, Trash2, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin-packs")({
  head: () => ({
    meta: [
      { title: "Pack Builder & Industry Pack CMS | DigiCRM AI" },
      { name: "description", content: "Create new industry packs and edit the stages, custom fields and AI agent prompts of every DigiCRM pack without touching code." },
      { property: "og:title", content: "Pack Builder | DigiCRM AI" },
      { property: "og:description", content: "Build new industry packs with their own stages, fields, KPIs and AI agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard allow={["super_admin", "admin"]}>
      <PackCms />
    </RoleGuard>
  ),
});

const FIELD_TYPES: PackFieldType[] = ["text", "number", "date", "select", "textarea"];
const VERIFICATION_KINDS = Object.keys(VERIFICATION_LABELS) as VerificationKind[];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

const isBuiltIn = (group: string, slug: string) =>
  INDUSTRY_PACKS.some((p) => p.group === group && p.slug === slug);

function PackCms() {
  const qc = useQueryClient();
  const { data: rows = [] } = usePackConfigs();
  const allPacks = useMemo(() => applyConfigs(rows), [rows]);
  const archived = useMemo(() => rows.filter((r) => r.archived_at && r.is_custom), [rows]);

  const [key, setKey] = useState(`${INDUSTRY_PACKS[0]!.group}::${INDUSTRY_PACKS[0]!.slug}`);
  const [group, slug] = key.split("::") as [string, string];
  const builtIn = useMemo(() => INDUSTRY_PACKS.find((p) => p.group === group && p.slug === slug), [group, slug]);
  const { data: override, isLoading } = usePackOverride(group, slug);
  const custom = !builtIn;

  const base = useMemo<IndustryPack>(
    () => builtIn ?? packFromRow(rows.find((r) => r.group_slug === group && r.pack_slug === slug) ?? { group_slug: group, pack_slug: slug }),
    [builtIn, rows, group, slug],
  );

  const [draft, setDraft] = useState<IndustryPack>(base);
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (isLoading) return;
    setDraft(builtIn ? mergePack(builtIn, override) : packFromRow(override ?? { group_slug: group, pack_slug: slug }));
    setDescription(override?.description ?? "");
  }, [builtIn, override, isLoading, group, slug]);

  const payload = (d: IndustryPack, asCustom: boolean, userId: string | null) => ({
    group_slug: d.group,
    pack_slug: d.slug,
    name: d.name,
    tagline: d.tagline,
    description,
    gradient: d.groupGradient,
    record_label: d.recordLabel,
    record_label_plural: d.recordLabelPlural,
    party_label: d.partyLabel,
    value_label: d.valueLabel,
    stages: d.stages,
    won_stages: d.wonStages,
    lost_stages: d.lostStages,
    kpi_labels: d.kpiLabels,
    verifications: d.verifications,
    fields: d.fields,
    agents: d.agents,
    is_custom: asCustom,
    archived_at: null,
    updated_by: userId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const body = payload(draft, custom, auth.user?.id ?? null);
      const { data: existing } = await supabase
        .from("pack_configs")
        .select("id")
        .is("tenant_id", null)
        .eq("group_slug", draft.group)
        .eq("pack_slug", draft.slug)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("pack_configs").update(body as never).eq("id", (existing as { id: string }).id)
        : await supabase.from("pack_configs").insert(body as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack saved");
      qc.invalidateQueries({ queryKey: ["pack-config", group, slug] });
      qc.invalidateQueries({ queryKey: ["pack-configs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pack_configs").delete().is("tenant_id", null).eq("group_slug", group).eq("pack_slug", slug);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(custom ? "Pack deleted" : "Reverted to the built-in pack");
      qc.invalidateQueries({ queryKey: ["pack-config", group, slug] });
      qc.invalidateQueries({ queryKey: ["pack-configs"] });
      if (custom) setKey(`${INDUSTRY_PACKS[0]!.group}::${INDUSTRY_PACKS[0]!.slug}`);
      else setDraft(base);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setArchived = useMutation({
    mutationFn: async (value: string | null) => {
      const { error } = await supabase
        .from("pack_configs")
        .update({ archived_at: value } as never)
        .is("tenant_id", null)
        .eq("group_slug", group)
        .eq("pack_slug", slug);
      if (error) throw error;
    },

    onSuccess: (_d, value) => {
      toast.success(value ? "Pack archived — records are kept" : "Pack restored");
      qc.invalidateQueries({ queryKey: ["pack-configs"] });
      qc.invalidateQueries({ queryKey: ["pack-config", group, slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPack = useMutation({
    mutationFn: async (p: { group: string; slug: string; name: string; tagline: string; from?: IndustryPack }) => {
      const { data: auth } = await supabase.auth.getUser();
      const src = p.from ?? draft;
      const next: IndustryPack = p.from
        ? { ...src, group: p.group, slug: p.slug, name: p.name, tagline: p.tagline }
        : {
            ...packFromRow({ group_slug: p.group, pack_slug: p.slug, name: p.name, tagline: p.tagline }),
            stages: ["New", "Qualified", "In progress", "Won", "Lost"],
            wonStages: ["Won"],
            lostStages: ["Lost"],
            fields: [{ key: "requirement", label: "Requirement", type: "text" }],
            agents: [],
            kpiLabels: ["Total", "Conversion rate", "Pipeline value"],
            verifications: [],
          };
      const { error } = await supabase.from("pack_configs").insert(payload(next, true, auth.user?.id ?? null) as never);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(`${next.name} created`);
      qc.invalidateQueries({ queryKey: ["pack-configs"] });
      setKey(`${next.group}::${next.slug}`);
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
      const stages = d.stages.map((s, idx) => (idx === i ? value : s));
      return {
        ...d,
        stages,
        wonStages: d.wonStages.map((s) => (s === old ? value : s)),
        lostStages: d.lostStages.map((s) => (s === old ? value : s)),
      };
    });

  const removeStage = (i: number) =>
    setDraft((d) => {
      const old = d.stages[i]!;
      return {
        ...d,
        stages: d.stages.filter((_, idx) => idx !== i),
        wonStages: d.wonStages.filter((s) => s !== old),
        lostStages: d.lostStages.filter((s) => s !== old),
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/admin"><ArrowLeft className="mr-1 h-4 w-4" />Super Admin</Link>
          </Button>
          <h1 className="text-2xl font-bold">Pack builder</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Create brand-new industry packs or reconfigure any built-in pack — terminology, pipeline stages, custom fields,
            KPIs, verification checks and AI agent prompts. Changes apply instantly to every workspace and client portal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewPackDialog
            packs={allPacks}
            pending={createPack.isPending}
            onCreate={(p) => createPack.mutate(p)}
          />
          <Button
            variant="outline"
            onClick={() => {
              const name = `${draft.name} copy`;
              createPack.mutate({ group: draft.group, slug: slugify(name), name, tagline: draft.tagline, from: draft });
            }}
            disabled={createPack.isPending}
          >
            <Copy className="mr-2 h-4 w-4" />Duplicate
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save pack
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pack</CardTitle>
          <CardDescription>
            {custom
              ? "Custom pack — built entirely from this page."
              : override
                ? "Built-in pack with custom configuration."
                : "Built-in pack using its shipped configuration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Industry pack</Label>
            <Select value={key} onValueChange={setKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {allPacks.map((p) => (
                  <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>
                    {p.groupName} — {p.name}
                    {!isBuiltIn(p.group, p.slug) ? " (custom)" : ""}
                  </SelectItem>
                ))}
                {archived.map((r) => (
                  <SelectItem key={`${r.group_slug}::${r.pack_slug}`} value={`${r.group_slug}::${r.pack_slug}`}>
                    {r.name ?? r.pack_slug} (archived)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/packs/$group/$slug" params={{ group, slug }}>Open workspace</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/portal/apply/$group/$slug" params={{ group, slug }}>Client portal</Link>
            </Button>
            {custom && (
              <Button variant="outline" size="sm" onClick={() => setArchived.mutate(override?.archived_at ? null : new Date().toISOString())} disabled={setArchived.isPending}>
                <Archive className="mr-2 h-4 w-4" />{override?.archived_at ? "Restore" : "Archive"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => reset.mutate()} disabled={reset.isPending || (!override && !custom)}>
              {custom ? <Trash2 className="mr-2 h-4 w-4 text-destructive" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              {custom ? "Delete pack" : "Reset to default"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="basics">
        <TabsList>
          <TabsTrigger value="basics">Basics & stages</TabsTrigger>
          <TabsTrigger value="fields">Fields ({draft.fields.length})</TabsTrigger>
          <TabsTrigger value="agents">AI agents ({draft.agents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Identity & terminology</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Pack name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Tagline</Label>
                <Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description (shown on the client portal)</Label>
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Record label</Label>
                <Input value={draft.recordLabel} onChange={(e) => setDraft({ ...draft, recordLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Record label (plural)</Label>
                <Input value={draft.recordLabelPlural} onChange={(e) => setDraft({ ...draft, recordLabelPlural: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Counterparty label</Label>
                <Input value={draft.partyLabel} onChange={(e) => setDraft({ ...draft, partyLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Value label</Label>
                <Input value={draft.valueLabel} onChange={(e) => setDraft({ ...draft, valueLabel: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>KPI labels (comma separated)</Label>
                <Input
                  value={draft.kpiLabels.join(", ")}
                  onChange={(e) => setDraft({ ...draft, kpiLabels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Verification checks</Label>
                <div className="flex flex-wrap gap-2">
                  {VERIFICATION_KINDS.map((v) => {
                    const on = draft.verifications.includes(v);
                    return (
                      <Badge
                        key={v}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            verifications: on ? d.verifications.filter((x) => x !== v) : [...d.verifications, v],
                          }))
                        }
                      >
                        {VERIFICATION_LABELS[v]}
                      </Badge>
                    );
                  })}
                </div>
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
                    <Button variant="ghost" size="icon" onClick={() => removeStage(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft((d) => ({ ...d, stages: [...d.stages, `Stage ${d.stages.length + 1}`] }))}
                >
                  <Plus className="mr-2 h-4 w-4" />Add stage
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Stages that count as won</Label>
                <div className="flex flex-wrap gap-2">
                  {draft.stages.map((s) => (
                    <Badge key={s} variant={draft.wonStages.includes(s) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggle("wonStages", s)}>
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stages that count as lost</Label>
                <div className="flex flex-wrap gap-2">
                  {draft.stages.map((s) => (
                    <Badge key={s} variant={draft.lostStages.includes(s) ? "destructive" : "outline"} className="cursor-pointer" onClick={() => toggle("lostStages", s)}>
                      {s}
                    </Badge>
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Key</Label>
                  <Input value={f.key} onChange={(e) => patchField(i, { key: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={f.type} onValueChange={(v) => patchField(i, { type: v as PackFieldType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Options (comma separated)</Label>
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
          <Button
            variant="outline"
            onClick={() => setDraft((d) => ({ ...d, fields: [...d.fields, { key: `field_${d.fields.length + 1}`, label: "New field", type: "text" }] }))}
          >
            <Plus className="mr-2 h-4 w-4" />Add field
          </Button>
        </TabsContent>

        <TabsContent value="agents" className="mt-4 space-y-3">
          {draft.agents.map((a, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Key</Label>
                    <Input value={a.key} onChange={(e) => patchAgent(i, { key: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input value={a.label} onChange={(e) => patchAgent(i, { label: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="ghost" size="icon" onClick={() => setDraft((d) => ({ ...d, agents: d.agents.filter((_, idx) => idx !== i) }))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Short description</Label>
                  <Input value={a.description} onChange={(e) => patchAgent(i, { description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prompt / instruction</Label>
                  <Textarea rows={4} value={a.instruction} onChange={(e) => patchAgent(i, { instruction: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                agents: [...d.agents, { key: `agent_${d.agents.length + 1}`, label: "New agent", description: "", instruction: "" }],
              }))
            }
          >
            <Plus className="mr-2 h-4 w-4" />Add agent
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewPackDialog({
  packs,
  pending,
  onCreate,
}: {
  packs: IndustryPack[];
  pending: boolean;
  onCreate: (p: { group: string; slug: string; name: string; tagline: string; from?: IndustryPack }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string>(PACK_GROUPS[0]);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [fromKey, setFromKey] = useState("blank");

  const submit = () => {
    const slug = slugify(name);
    if (!slug) return;
    const from = fromKey === "blank" ? undefined : packs.find((p) => `${p.group}::${p.slug}` === fromKey);
    onCreate({ group, slug, name: name.trim(), tagline: tagline.trim() || `${name.trim()} pipeline.`, ...(from ? { from } : {}) });
    setOpen(false);
    setName("");
    setTagline("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Wand2 className="mr-2 h-4 w-4" />New pack</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an industry pack</DialogTitle>
          <DialogDescription>Start blank or copy an existing pack, then tune stages, fields and AI agents.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Industry group</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PACK_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>{INDUSTRY_GROUPS.find((x) => x.slug === g)?.name ?? g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pack name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Equipment leasing" />
            {name && <p className="text-xs text-muted-foreground">Slug: {slugify(name)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Lease enquiries to signed contracts." />
          </div>
          <div className="space-y-1.5">
            <Label>Start from</Label>
            <Select value={fromKey} onValueChange={setFromKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="blank">Blank pack</SelectItem>
                {packs.map((p) => (
                  <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>{p.groupName} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !slugify(name)}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Create pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
