import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/lib/queries/tenants";
import { useAllPacks, useTenantPackKey } from "@/lib/pack-config";
import { runVerification, type VerifyKind } from "@/lib/verify.functions";
import { VERIFICATION_LABELS } from "@/lib/industry-packs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Check, FileText, IndianRupee, Loader2, Search, ShieldCheck, Upload, X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/tenant-portal")({
  head: () => ({
    meta: [
      { title: "Workspace Portal Desk | DigiCRM AI" },
      { name: "description", content: "Review your workspace's own applications, approve client documents and run identity checks without leaving your pack." },
      { property: "og:title", content: "Workspace Portal Desk | DigiCRM AI" },
      { property: "og:description", content: "Applications, documents and identity checks for your own workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TenantPortalDesk,
});

type Rec = {
  id: string; title: string; stage: string; value: number | null; won: boolean | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null;
  city: string | null; created_at: string;
};
type Doc = { id: string; name: string; doc_type: string; status: string; created_at: string; storage_path: string | null };
type Pay = { id: string; kind: string; label: string; amount: number; status: string; due_date: string | null; paid_at: string | null; method: string | null; reference: string | null; payer_note: string | null; submitted_at: string | null; decision_note: string | null };
type Ver = { id: string; kind: string; status: string; provider: string; score: number | null; identifier_masked: string | null; created_at: string; error: string | null };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const statusTone = (s: string) =>
  s === "verified" || s === "approved" || s === "paid"
    ? "bg-green-500/15 text-green-600"
    : s === "rejected" || s === "failed"
      ? "bg-destructive/15 text-destructive"
      : "bg-amber-500/15 text-amber-600";

function TenantPortalDesk() {
  const { active, loading } = useActiveTenant();
  const { packs } = useAllPacks();
  const qc = useQueryClient();
  const { user } = useAuth();
  const verify = useServerFn(runVerification);

  const [key, setKey] = useState("");
  const tenantPackKey = useTenantPackKey(active?.id ?? null);
  const packKey = key || tenantPackKey || (packs[0] ? `${packs[0].group}::${packs[0].slug}` : "");
  const [group, slug] = packKey.split("::");
  const pack = packs.find((p) => p.group === group && p.slug === slug);


  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [vKind, setVKind] = useState<VerifyKind>("pan");
  const [vValue, setVValue] = useState("");
  const [vIfsc, setVIfsc] = useState("");
  const [vBusy, setVBusy] = useState(false);

  const tenantId = active?.id ?? null;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["desk-records", tenantId, group, slug],
    enabled: !!tenantId && !!group && !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_records")
        .select("id, title, stage, value, won, contact_name, contact_email, contact_phone, city, created_at")
        .eq("tenant_id", tenantId!)
        .eq("group_slug", group!)
        .eq("pack_slug", slug!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => [r.title, r.contact_name, r.contact_email, r.city, r.stage].some((v) => v?.toLowerCase().includes(q)));
  }, [records, search]);

  const current = filtered.find((r) => r.id === selected) ?? filtered[0] ?? null;

  const { data: docs = [] } = useQuery({
    queryKey: ["desk-docs", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_documents")
        .select("id, name, doc_type, status, created_at, storage_path")
        .eq("record_id", current!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["desk-payments", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_payments")
        .select("id, kind, label, amount, status, due_date, paid_at, method, reference, payer_note, submitted_at, decision_note")
        .eq("record_id", current!.id)
        .order("due_date");
      if (error) throw error;
      return (data ?? []) as Pay[];
    },
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ["desk-verifications", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verifications")
        .select("id, kind, status, provider, score, identifier_masked, created_at, error")
        .eq("record_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ver[];
    },
  });

  const setStage = useMutation({
    mutationFn: async (stage: string) => {
      const won = pack?.wonStages.includes(stage) ? true : pack?.lostStages.includes(stage) ? false : null;
      const { error } = await supabase
        .from("pack_records")
        .update({ stage, won, closed_at: won === null ? null : new Date().toISOString() })
        .eq("id", current!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["desk-records"] });
      qc.invalidateQueries({ queryKey: ["tenant-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDocStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pack_documents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document updated");
      qc.invalidateQueries({ queryKey: ["desk-docs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pack_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment confirmed");
      qc.invalidateQueries({ queryKey: ["desk-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Money never arrived, or the reference does not match — send it back with a reason.
  const rejectPayment = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("pack_payments")
        .update({
          status: "rejected",
          decision_note: reason,
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment sent back to the client");
      qc.invalidateQueries({ queryKey: ["desk-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const upload = async (file: File) => {
    if (!current) return;
    setUploading(true);
    try {
      const path = `pack_records/${current.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("pack_documents").insert({
        record_id: current.id,
        name: file.name,
        doc_type: "other",
        status: "uploaded",
        storage_path: path,
      } as never);
      if (error) throw error;
      toast.success("Document added");
      qc.invalidateQueries({ queryKey: ["desk-docs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const runCheck = async () => {
    if (!current) return;
    setVBusy(true);
    try {
      const res = await verify({
        data: {
          kind: vKind,
          value: vValue,
          ifsc: vIfsc,
          recordId: current.id,
          subjectName: current.contact_name ?? undefined,
          mobile: current.contact_phone ?? undefined,
        },
      });
      if (res.status === "verified") toast.success(`${VERIFICATION_LABELS[vKind]} verified`);
      else if (res.status === "manual_review") toast.warning("Needs a manual look");
      else toast.error(res.error ?? "Check failed");
      setVValue("");
      qc.invalidateQueries({ queryKey: ["desk-verifications"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check failed");
    } finally {
      setVBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>;
  if (!active) {
    return (
      <Card className="m-4"><CardContent className="p-10 text-center text-sm text-muted-foreground">
        You do not have a workspace yet — set one up first.
      </CardContent></Card>
    );
  }

  const allowedChecks: VerifyKind[] = pack?.verifications?.length
    ? pack.verifications
    : ["pan", "aadhaar", "gst", "bank_account"];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{active.name} — portal desk</h1>
          <p className="text-sm text-muted-foreground">
            Everything your clients send you: their {pack?.recordLabelPlural ?? "files"}, their documents and their identity checks.
          </p>
        </div>
        <Select value={packKey} onValueChange={(v) => { setKey(v); setSelected(null); }}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Choose a pack" /></SelectTrigger>
          <SelectContent className="max-h-80">
            {packs.map((p) => (
              <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>{p.groupName} — {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{pack?.recordLabelPlural ?? "Files"} ({filtered.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search name, city or stage" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[32rem] overflow-y-auto">
            {isLoading && <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>}
            {!isLoading && filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet for this pack.</p>
            )}
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${current?.id === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <p className="truncate text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">{r.contact_name ?? r.contact_email ?? "—"}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{r.stage}</Badge>
                  {r.value != null && <span className="text-xs text-muted-foreground">{inr(Number(r.value))}</span>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {current ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{current.title}</CardTitle>
                <CardDescription>
                  {current.contact_name ?? "—"}
                  {current.contact_email ? ` · ${current.contact_email}` : ""}
                  {current.city ? ` · ${current.city}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Stage</Label>
                  <Select value={current.stage} onValueChange={(v) => setStage.mutate(v)}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(pack?.stages ?? [current.stage]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{pack?.valueLabel ?? "Value"}</Label>
                  <p className="text-lg font-semibold">{current.value != null ? inr(Number(current.value)) : "—"}</p>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="documents">
              <TabsList>
                <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" />Documents ({docs.length})</TabsTrigger>
                <TabsTrigger value="verify"><ShieldCheck className="mr-2 h-4 w-4" />Verifications ({verifications.length})</TabsTrigger>
                <TabsTrigger value="payments"><IndianRupee className="mr-2 h-4 w-4" />Payments ({payments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="documents" className="mt-4 space-y-3">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Review</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {docs.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No documents yet.</TableCell></TableRow>
                        )}
                        {docs.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell className="max-w-[240px] truncate">{d.name}</TableCell>
                            <TableCell className="text-xs">{d.doc_type}</TableCell>
                            <TableCell><Badge className={statusTone(d.status)}>{d.status}</Badge></TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button size="sm" variant="outline" onClick={() => setDocStatus.mutate({ id: d.id, status: "verified" })}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setDocStatus.mutate({ id: d.id, status: "rejected" })}>
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <div>
                  <input
                    id="desk-upload" type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }}
                  />
                  <Button variant="outline" disabled={uploading} onClick={() => document.getElementById("desk-upload")?.click()}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Add a document
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="verify" className="mt-4 space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Run a check on this {pack?.recordLabel ?? "file"}</CardTitle>
                    <CardDescription>Only a masked reference and the outcome are kept — never the full number.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Check</Label>
                      <Select value={vKind} onValueChange={(v) => setVKind(v as VerifyKind)}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allowedChecks.filter((k) => k !== "document_ocr").map((k) => (
                            <SelectItem key={k} value={k}>{VERIFICATION_LABELS[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Number</Label>
                      <Input className="w-56" value={vValue} onChange={(e) => setVValue(e.target.value)} placeholder="Enter the value to check" />
                    </div>
                    {vKind === "bank_account" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">IFSC</Label>
                        <Input className="w-40" value={vIfsc} onChange={(e) => setVIfsc(e.target.value)} />
                      </div>
                    )}
                    <Button onClick={runCheck} disabled={vBusy || vValue.trim().length < 4}>
                      {vBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Run check
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Check</TableHead><TableHead>Reference</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {verifications.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No checks run yet.</TableCell></TableRow>
                        )}
                        {verifications.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell className="whitespace-nowrap text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                            <TableCell className="text-xs">{VERIFICATION_LABELS[v.kind as VerifyKind] ?? v.kind}</TableCell>
                            <TableCell className="font-mono text-xs">{v.identifier_masked ?? "—"}</TableCell>
                            <TableCell>
                              <Badge className={statusTone(v.status)}>{v.status}</Badge>
                              {v.score != null && <span className="ml-2 text-xs text-muted-foreground">score {v.score}</span>}
                              {v.error && <span className="ml-2 text-xs text-destructive">{v.error}</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Due</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {payments.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No payments recorded.</TableCell></TableRow>
                        )}
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {p.label}<span className="ml-2 text-xs text-muted-foreground">{p.kind}</span>
                              {p.reference && (
                                <div className="text-xs text-muted-foreground">
                                  {p.method ?? "payment"} · {p.reference}
                                  {p.submitted_at ? ` · client sent ${new Date(p.submitted_at).toLocaleDateString()}` : ""}
                                </div>
                              )}
                              {p.payer_note && <div className="text-xs text-muted-foreground">“{p.payer_note}”</div>}
                              {p.decision_note && <div className="text-xs text-destructive">{p.decision_note}</div>}
                            </TableCell>
                            <TableCell className="text-xs">{p.due_date ? new Date(p.due_date).toLocaleDateString() : "—"}</TableCell>
                            <TableCell>{inr(Number(p.amount))}</TableCell>
                            <TableCell>
                              <Badge className={statusTone(p.status)}>
                                {p.status === "pending_confirmation" ? "awaiting confirmation" : p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="space-x-2 text-right">
                              {p.status !== "paid" && (
                                <Button size="sm" variant="outline" onClick={() => markPaid.mutate(p.id)}>
                                  {p.status === "pending_confirmation" ? "Confirm received" : "Mark paid"}
                                </Button>
                              )}
                              {p.status === "pending_confirmation" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const reason = window.prompt("Why are you sending this back to the client?");
                                    if (reason && reason.trim()) rejectPayment.mutate({ id: p.id, reason: reason.trim() });
                                  }}
                                >
                                  Not received
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
            </Tabs>
          </div>
        ) : (
          <Card><CardContent className="p-16 text-center text-sm text-muted-foreground">
            Pick a {pack?.recordLabel ?? "file"} on the left to review it.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
