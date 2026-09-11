import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getPack, VERIFICATION_LABELS, type IndustryPack, type PackField } from "@/lib/industry-packs";
import { usePack } from "@/lib/pack-config";
import { runPackAgent } from "@/lib/pack-agent.functions";

import { runVerification } from "@/lib/verify.functions";
import { IndustryGuard } from "@/components/industry-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Sparkles, ShieldCheck, Trash2, Loader2, TrendingUp, IndianRupee, Target, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/packs/$group/$slug")({
  loader: ({ params }) => ({ pack: getPack(params.group, params.slug) ?? null }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.pack?.name ?? "Industry"} Workspace | DigiCRM AI` },
      { name: "description", content: loaderData?.pack?.tagline ?? "Industry pack workspace" },
    ],
  }),
  component: PackWorkspaceRoute,
});

type PackRecord = {
  id: string; title: string; stage: string; value: number | null; currency: string;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  city: string | null; source: string | null; priority: string; notes: string | null;
  fields: Record<string, string> | null; next_action_at: string | null; created_at: string;
  owner_id: string | null;
};

const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`);

/** Resolves built-in, overridden and fully custom packs alike. */
function PackWorkspaceRoute() {
  const { group, slug } = Route.useParams();
  const { pack, isLoading } = usePack(group, slug);
  if (isLoading) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!pack) return <div className="p-12 text-center text-sm text-muted-foreground">This pack no longer exists. <Link to="/packs" className="text-primary underline">Back to industry packs</Link></div>;
  return (
    <IndustryGuard group={group}>
      <PackWorkspace pack={pack} />
    </IndustryGuard>
  );
}

function PackWorkspace({ pack }: { pack: IndustryPack }) {


  const { user, isAdmin, isManager } = useAuth();
  const qc = useQueryClient();
  const canDelete = isAdmin || isManager;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["pack-records", pack.group, pack.slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_records")
        .select("*")
        .eq("group_slug", pack.group)
        .eq("pack_slug", pack.slug)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PackRecord[];
    },
  });

  const stats = useMemo(() => {
    const total = records.length;
    const won = records.filter((r) => pack.wonStages.includes(r.stage));
    const pipelineValue = records.filter((r) => !pack.wonStages.includes(r.stage)).reduce((s, r) => s + Number(r.value ?? 0), 0);
    const wonValue = won.reduce((s, r) => s + Number(r.value ?? 0), 0);
    return {
      total,
      won: won.length,
      conversion: total ? Math.round((won.length / total) * 100) : 0,
      pipelineValue,
      avgValue: total ? Math.round(records.reduce((s, r) => s + Number(r.value ?? 0), 0) / total) : 0,
      wonValue,
    };
  }, [records, pack.wonStages]);

  const funnel = pack.stages.map((stage) => ({ stage, count: records.filter((r) => r.stage === stage).length }));

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Link to="/packs" className="hover:text-foreground">Industry packs</Link>
            <span>/</span>
            <span>{pack.groupName}</span>
          </div>
          <h1 className="text-2xl font-bold">{pack.name}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">{pack.tagline}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant="secondary" className="text-[10px]">Deal = {pack.recordLabel}</Badge>
            <Badge variant="secondary" className="text-[10px]">Customer = {pack.partyLabel}</Badge>
            <Badge variant="secondary" className="text-[10px]">Value = {pack.valueLabel}</Badge>
          </div>
        </div>
        <RecordDialog pack={pack} userId={user?.id ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["pack-records", pack.group, pack.slug] })} />
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: pack.recordLabelPlural, value: stats.total, icon: Target },
          { label: "Conversion rate", value: `${stats.conversion}%`, icon: TrendingUp },
          { label: "Open pipeline", value: inr(stats.pipelineValue), icon: IndianRupee },
          { label: `Avg ${pack.valueLabel.toLowerCase()}`, value: inr(stats.avgValue), icon: Gauge },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className="mt-1 text-2xl font-bold">{k.value}</div>
              </div>
              <k.icon className="h-8 w-8 text-muted-foreground/40" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pack KPIs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {pack.kpiLabels.map((k) => (
            <Badge key={k} variant="outline" className="text-[11px]">{k}</Badge>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="records">{pack.recordLabelPlural}</TabsTrigger>
          <TabsTrigger value="agents">AI agents</TabsTrigger>
          <TabsTrigger value="verify">DigiVerify</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Stage funnel</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnel}>
                  <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            {pack.stages.map((stage) => (
              <Card key={stage} className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>{stage}</span>
                    <Badge variant="secondary" className="text-[10px]">{records.filter((r) => r.stage === stage).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {records.filter((r) => r.stage === stage).map((r) => (
                    <div key={r.id} className="rounded-md border bg-background p-2 text-xs space-y-1">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-muted-foreground">{r.contact_name ?? pack.partyLabel} · {inr(Number(r.value ?? 0))}</div>
                      <StageSelect pack={pack} record={r} onDone={() => qc.invalidateQueries({ queryKey: ["pack-records", pack.group, pack.slug] })} />
                    </div>
                  ))}
                  {records.filter((r) => r.stage === stage).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Nothing here yet.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="records" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{pack.recordLabel}</TableHead>
                    <TableHead>{pack.partyLabel}</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">{pack.valueLabel}</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell></TableRow>}
                  {!isLoading && records.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No {pack.recordLabelPlural.toLowerCase()} yet — create the first one.
                    </TableCell></TableRow>
                  )}
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.contact_name ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.stage}</Badge></TableCell>
                      <TableCell className="text-right">{inr(Number(r.value ?? 0))}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.city ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {canDelete && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={async () => {
                              const { error } = await supabase.from("pack_records").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
                              if (error) toast.error(error.message);
                              else { toast.success(`${pack.recordLabel} archived`); qc.invalidateQueries({ queryKey: ["pack-records", pack.group, pack.slug] }); }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="pt-4">
          <AgentPanel pack={pack} records={records} />
        </TabsContent>

        <TabsContent value="verify" className="pt-4">
          <VerifyPanel pack={pack} records={records} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StageSelect({ pack, record, onDone }: { pack: IndustryPack; record: PackRecord; onDone: () => void }) {
  return (
    <Select
      value={record.stage}
      onValueChange={async (stage) => {
        const won = pack.wonStages.includes(stage);
        const patch = won
          ? { stage, closed_at: new Date().toISOString(), won: true }
          : { stage };
        const { error } = await supabase.from("pack_records").update(patch).eq("id", record.id);
        if (error) toast.error(error.message); else { toast.success(`Moved to ${stage}`); onDone(); }
      }}
    >
      <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {pack.stages.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function FieldInput({ field, value, onChange }: { field: PackField; value: string; onChange: (v: string) => void }) {
  if (field.type === "select") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>{field.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (field.type === "textarea") return <Textarea value={value} onChange={(e) => onChange(e.target.value)} />;
  return <Input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function RecordDialog({ pack, userId, onSaved }: { pack: IndustryPack; userId: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", stage: pack.stages[0]!, contact_name: "", contact_email: "", contact_phone: "", city: "", value: "", source: "", notes: "" });
  const [extra, setExtra] = useState<Record<string, string>>({});

  const save = async () => {
    if (!form.title.trim()) { toast.error(`Give the ${pack.recordLabel.toLowerCase()} a title`); return; }
    if (!userId) { toast.error("You must be signed in"); return; }
    setSaving(true);
    const { error } = await supabase.from("pack_records").insert({
      group_slug: pack.group, pack_slug: pack.slug,
      title: form.title.trim(), stage: form.stage,
      contact_name: form.contact_name || null, contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null, city: form.city || null,
      value: form.value ? Number(form.value) : 0, source: form.source || null,
      notes: form.notes || null, fields: extra,
      owner_id: userId, created_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${pack.recordLabel} created`);
    setForm({ title: "", stage: pack.stages[0]!, contact_name: "", contact_email: "", contact_phone: "", city: "", value: "", source: "", notes: "" });
    setExtra({});
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />New {pack.recordLabel.toLowerCase()}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New {pack.recordLabel.toLowerCase()}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1">
            <Label>{pack.recordLabel} title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>{pack.partyLabel} name</Label>
            <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{pack.stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          <div className="space-y-1"><Label>{pack.valueLabel}</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="space-y-1"><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
          {pack.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <FieldInput field={f} value={extra[f.key] ?? ""} onChange={(v) => setExtra({ ...extra, [f.key]: v })} />
            </div>
          ))}
          <div className="sm:col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentPanel({ pack, records }: { pack: IndustryPack; records: PackRecord[] }) {
  const run = useServerFn(runPackAgent);
  const [agentKey, setAgentKey] = useState(pack.agents[0]?.key ?? "");
  const [recordId, setRecordId] = useState<string>("all");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);

  const go = async () => {
    setBusy(true); setOutput(null);
    try {
      const res = await run({ data: { group: pack.group, slug: pack.slug, agentKey, recordId: recordId === "all" ? null : recordId, question } });
      setOutput(res.output);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" />Pack agents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Agent</Label>
            <Select value={agentKey} onValueChange={setAgentKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{pack.agents.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Scope</Label>
            <Select value={recordId} onValueChange={setRecordId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole pipeline</SelectItem>
                {records.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Ask something (optional)</Label>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={`e.g. which ${pack.recordLabelPlural.toLowerCase()} are at risk this week?`} />
          </div>
          <Button className="w-full" onClick={go} disabled={busy || !agentKey}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Run agent
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Output</CardTitle></CardHeader>
        <CardContent>
          {output
            ? <pre className="whitespace-pre-wrap text-sm leading-relaxed">{output}</pre>
            : <p className="text-sm text-muted-foreground">Pick an agent and run it — every run is grounded in the records you can see and is logged for audit.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function VerifyPanel({ pack, records }: { pack: IndustryPack; records: PackRecord[] }) {
  const verify = useServerFn(runVerification);
  const qc = useQueryClient();
  const [kind, setKind] = useState(pack.verifications[0] ?? "pan");
  const [value, setValue] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [subject, setSubject] = useState("");
  const [recordId, setRecordId] = useState("none");
  const [file, setFile] = useState<{ dataUrl: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: history = [] } = useQuery({
    queryKey: ["verifications", pack.slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("verifications")
        .select("id, kind, status, provider, score, identifier_masked, subject_name, created_at, error")
        .order("created_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await verify({
        data: {
          kind, value, ifsc, subjectName: subject || undefined,
          recordId: recordId === "none" ? null : recordId,
          fileDataUrl: file?.dataUrl, fileName: file?.name,
          docHint: `${pack.name} supporting document`,
        },
      });
      if (res.status === "verified") toast.success(`${VERIFICATION_LABELS[kind]} verified`);
      else if (res.status === "manual_review") toast.warning("Needs manual review");
      else toast.error(res.error ?? "Verification failed");
      qc.invalidateQueries({ queryKey: ["verifications", pack.slug] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Run a check</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Check type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{pack.verifications.map((k) => <SelectItem key={k} value={k}>{VERIFICATION_LABELS[k]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {kind === "document_ocr" ? (
            <div className="space-y-1">
              <Label>Document (image or PDF)</Label>
              <Input
                type="file" accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) { setFile(null); return; }
                  const reader = new FileReader();
                  reader.onload = () => setFile({ dataUrl: String(reader.result), name: f.name });
                  reader.readAsDataURL(f);
                }}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label>{VERIFICATION_LABELS[kind]} {kind === "bank_account" ? "number" : "value"}</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
          {kind === "bank_account" && (
            <div className="space-y-1"><Label>IFSC</Label><Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} /></div>
          )}
          <div className="space-y-1"><Label>{pack.partyLabel} name</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Attach to</Label>
            <Select value={recordId} onValueChange={setRecordId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {records.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Only a masked identifier is stored. Credit bureau results are simulated until a licensed bureau is connected.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent verifications</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Type</TableHead><TableHead>Subject</TableHead><TableHead>Identifier</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No checks run yet.</TableCell></TableRow>}
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-sm">{VERIFICATION_LABELS[h.kind as keyof typeof VERIFICATION_LABELS] ?? h.kind}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.subject_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{h.identifier_masked}</TableCell>
                  <TableCell>
                    <Badge variant={h.status === "verified" ? "default" : h.status === "manual_review" ? "secondary" : "destructive"} className="text-[10px]">
                      {h.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{h.score ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
