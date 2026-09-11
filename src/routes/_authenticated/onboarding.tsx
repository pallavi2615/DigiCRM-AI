import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllPacks } from "@/lib/pack-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { IndustryPack } from "@/lib/industry-packs";
import { claimIndustry } from "@/lib/industry-access";
import { setActiveIndustry } from "@/lib/active-industry";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your workspace | DigiCRM AI" },
      { name: "description", content: "Create your workspace, pick the industry pack you sell with, and set your own pipeline stages and assistant prompts." },
      { property: "og:title", content: "Set up your workspace | DigiCRM AI" },
      { property: "og:description", content: "Create a workspace, pick a pack, set your stages and prompts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { packs, isLoading } = useAllPacks();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [packKey, setPackKey] = useState("");
  const [stages, setStages] = useState<string[]>([]);
  const [agents, setAgents] = useState<IndustryPack["agents"]>([]);

  const pack = packs.find((p) => `${p.group}::${p.slug}` === packKey);

  const choosePack = (p: IndustryPack) => {
    setPackKey(`${p.group}::${p.slug}`);
    setStages([...p.stages]);
    setAgents(p.agents.map((a) => ({ ...a })));
  };

  const finish = useMutation({
    mutationFn: async () => {
      if (!pack) throw new Error("Choose the pack you work with first.");
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Please sign in again.");

      const finalSlug = slug || slugify(name) || `workspace-${Date.now()}`;
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({
          name: name.trim(),
          slug: finalSlug,
          tagline: tagline.trim() || null,
          plan: "lite",
          industry: pack.groupName,
          owner_id: uid,
          is_active: true,
        } as never)
        .select("id, slug")
        .single();
      if (tErr) throw tErr;

      await supabase.from("tenant_members").insert({
        tenant_id: tenant.id,
        user_id: uid,
        member_role: "owner",
      } as never);

      const { error: pErr } = await supabase.from("pack_configs").insert({
        tenant_id: tenant.id,
        group_slug: pack.group,
        pack_slug: pack.slug,
        name: pack.name,
        tagline: pack.tagline,
        description: pack.tagline,
        gradient: pack.groupGradient,
        record_label: pack.recordLabel,
        record_label_plural: pack.recordLabelPlural,
        party_label: pack.partyLabel,
        value_label: pack.valueLabel,
        stages,
        won_stages: pack.wonStages,
        lost_stages: pack.lostStages,
        fields: pack.fields,
        agents,
        kpi_labels: pack.kpiLabels,
        verifications: pack.verifications,
        is_custom: false,
        created_by: uid,
      } as never);
      if (pErr) throw pErr;

      // The pack they picked also sets the industry they may work in. The
      // database refuses this quietly if an administrator already set one.
      try {
        await claimIndustry(uid, pack.group);
        setActiveIndustry(pack.group);
      } catch {
        /* an industry is already assigned to this account */
      }

      if (typeof window !== "undefined") localStorage.setItem("digicrm.active_tenant", tenant.id);
      return tenant;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-tenants"] });
      await qc.invalidateQueries({ queryKey: ["pack-configs"] });
      toast.success("Your workspace is ready");
      navigate({ to: "/tenant-dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canNext = step === 0 ? name.trim().length > 1 : step === 1 ? !!pack : stages.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Set up your workspace</h1>
        <p className="text-sm text-muted-foreground">Three short steps. You can change everything later in Pack Settings.</p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {["Your business", "Your pack", "Stages & prompts"].map((label, i) => (
          <Badge key={label} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="gap-1">
            {i < step && <Check className="h-3 w-3" />}{i + 1}. {label}
          </Badge>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tell us about your business</CardTitle>
            <CardDescription>This name appears across your workspace and your client portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Business name</Label>
              <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(""); }} placeholder="Apex Finserv" />
            </div>
            <div className="space-y-1.5">
              <Label>Web address</Label>
              <Input value={slug || slugify(name)} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="apex-finserv" />
            </div>
            <div className="space-y-1.5">
              <Label>One-line description</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Loans made simple for small businesses" />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What do you sell?</CardTitle>
            <CardDescription>Pick the closest match — it sets your stages, fields and assistant wording.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 max-h-[26rem] overflow-y-auto">
                {packs.map((p) => {
                  const k = `${p.group}::${p.slug}`;
                  return (
                    <button
                      key={k}
                      onClick={() => choosePack(p)}
                      className={`rounded-lg border p-3 text-left transition-colors ${packKey === k ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.groupName} · {p.stages.length} stages</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && pack && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your stages</CardTitle>
              <CardDescription>Rename them to whatever your team says out loud.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {stages.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s} onChange={(e) => setStages((xs) => xs.map((x, idx) => (idx === i ? e.target.value : x)))} />
                  <Button variant="ghost" size="icon" onClick={() => setStages((xs) => xs.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setStages((xs) => [...xs, "New stage"])}>
                <Plus className="mr-2 h-4 w-4" />Add stage
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assistant prompts</CardTitle>
              <CardDescription>What the assistant should do for you, in your words.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agents.map((a, i) => (
                <div key={a.key} className="space-y-1.5 rounded-lg border p-3">
                  <Label className="text-xs">{a.label}</Label>
                  <Textarea
                    rows={3}
                    value={a.instruction}
                    onChange={(e) => setAgents((xs) => xs.map((x, idx) => (idx === i ? { ...x, instruction: e.target.value } : x)))}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        {step < 2 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!canNext || finish.isPending} onClick={() => finish.mutate()}>
            {finish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Create my workspace
          </Button>
        )}
      </div>
    </div>
  );
}
