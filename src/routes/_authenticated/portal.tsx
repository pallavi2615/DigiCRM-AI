import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAllPacks } from "@/lib/pack-config";
import { VERIFICATION_LABELS } from "@/lib/industry-packs";
import { ClientStageTracker } from "@/components/client-stage-tracker";
import { PortalApplyDialog } from "@/components/portal-apply-dialog";
import { PortalPayDialog } from "@/components/portal-pay-dialog";
import { useIndustryAccess } from "@/lib/industry-access";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, IndianRupee, Loader2, Plus, ReceiptText, Search, ShieldCheck, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({
    meta: [
      { title: "DigiPortal — Client & Partner Portal | DigiCRM AI" },
      { name: "description", content: "One portal where clients, dealers and agents track their deals, documents and payments across every DigiCRM industry pack." },
      { property: "og:title", content: "DigiPortal — Client & Partner Portal" },
      { property: "og:description", content: "Track deals, documents and payments in one shared portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Portal,
});

type Rec = {
  id: string; group_slug: string; pack_slug: string; title: string; stage: string;
  value: number | null; contact_name: string | null; contact_email: string | null;
  city: string | null; owner_id: string | null; created_at: string; won: boolean | null;
};
type Doc = { id: string; record_id: string; name: string; doc_type: string; status: string; created_at: string };
type Ver = { id: string; kind: string; status: string; provider: string; score: number | null; identifier_masked: string | null; subject_name: string | null; created_at: string; error: string | null };
type Pay = { id: string; record_id: string; kind: string; label: string; amount: number; currency: string; status: string; due_date: string | null; paid_at: string | null; reference: string | null; method: string | null; decision_note: string | null };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Portal() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { packs } = useAllPacks();
  const { canUse } = useIndustryAccess();
  const [uploading, setUploading] = useState(false);
  const [packKey, setPackKey] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["portal-records", user?.id, user?.email],
    enabled: !!user,
    queryFn: async () => {
      const email = user?.email ?? "";
      const { data, error } = await supabase
        .from("pack_records")
        .select("id, group_slug, pack_slug, title, stage, value, contact_name, contact_email, city, owner_id, created_at, won")
        .is("deleted_at", null)
        .or(`owner_id.eq.${user!.id}${email ? `,contact_email.eq.${email}` : ""}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (packKey !== "all" && `${r.group_slug}::${r.pack_slug}` !== packKey) return false;
      if (!q) return true;
      return [r.title, r.contact_name, r.city, r.stage].some((v) => v?.toLowerCase().includes(q));
    });
  }, [records, packKey, search]);

  const current = filtered.find((r) => r.id === selected) ?? filtered[0] ?? null;

  const { data: docs = [] } = useQuery({
    queryKey: ["portal-docs", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_documents")
        .select("id, record_id, name, doc_type, status, created_at")
        .eq("record_id", current!.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["portal-payments", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_payments")
        .select("id, record_id, kind, label, amount, currency, status, due_date, paid_at, reference, method, decision_note")
        .eq("record_id", current!.id)
        .order("due_date");
      if (error) throw error;
      return (data ?? []) as Pay[];
    },
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ["portal-verifications", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verifications")
        .select("id, kind, status, provider, score, identifier_masked, subject_name, created_at, error")
        .eq("record_id", current!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ver[];
    },
  });

  const packOf = (r: Rec) => packs.find((p) => p.group === r.group_slug && p.slug === r.pack_slug);
  const packName = (r: Rec) => packOf(r)?.name ?? r.pack_slug;

  const uploadDoc = async (file: File) => {
    if (!current || !user) return;
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
        uploaded_by: user.id,
      } as never);
      if (error) throw error;
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["portal-docs", current.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const totals = useMemo(() => {
    const open = filtered.filter((r) => !r.won);
    return {
      deals: filtered.length,
      open: open.length,
      value: filtered.reduce((s, r) => s + Number(r.value ?? 0), 0),
    };
  }, [filtered]);

  // Clients only ever see the services of the industry they signed up for.
  const myPacks = useMemo(() => packs.filter((p) => canUse(p.group)), [packs, canUse]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">DigiPortal</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Apply, send us your documents, watch your checks come back and follow your application — all in one place.
          </p>
        </div>
        <PortalApplyDialog packs={myPacks} />
      </div>


      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Deals", value: totals.deals, icon: ShieldCheck },
          { label: "In progress", value: totals.open, icon: FileText },
          { label: "Total value", value: inr(totals.value), icon: IndianRupee },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-xl font-semibold">{k.value}</div>
              </div>
              <k.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search deals" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={packKey} onValueChange={setPackKey}>
          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="all">All industry packs</SelectItem>
            {myPacks.map((p) => (
              <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>{p.groupName} — {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Your deals</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Nothing assigned to you yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 60).map((r) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer ${current?.id === r.id ? "bg-muted/60" : ""}`}
                      onClick={() => setSelected(r.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{r.contact_name ?? "—"}{r.city ? ` · ${r.city}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-xs">{packName(r)}</TableCell>
                      <TableCell><Badge variant={r.won ? "default" : "secondary"} className="text-[10px]">{r.stage}</Badge></TableCell>
                      <TableCell className="text-right">{inr(Number(r.value ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{current ? current.title : "Select a deal"}</CardTitle>
            {current && (
              <CardDescription>
                {packName(current)} · {current.stage}
                {" · "}
                <Link
                  to="/packs/$group/$slug"
                  params={{ group: current.group_slug, slug: current.pack_slug }}
                  className="text-primary hover:underline"
                >
                  open workspace
                </Link>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!current ? (
              <p className="text-sm text-muted-foreground">Pick a deal on the left to see its documents and payments.</p>
            ) : (
              <>
                <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                  <ClientStageTracker
                    stage={current.stage}
                    packStages={packOf(current)?.stages ?? [current.stage]}
                    won={current.won}
                    docCount={docs.length}
                  />
                </div>

                <Tabs defaultValue="documents">
                  <TabsList className="w-full">
                    <TabsTrigger value="documents" className="flex-1">Documents</TabsTrigger>
                    <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
                    <TabsTrigger value="verify" className="flex-1">DigiVerify</TabsTrigger>
                  </TabsList>
                  <TabsContent value="documents" className="mt-3 space-y-2">
                    {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents yet.</p>}
                    {docs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.name}</span>
                        <Badge variant={d.status === "verified" ? "default" : "secondary"} className="text-[10px]">{d.status}</Badge>
                      </div>
                    ))}
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:border-primary/50">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : "Upload a document"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadDoc(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </TabsContent>

                  <TabsContent value="payments" className="mt-3 space-y-2">
                  {payments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nothing to pay right now. If you have already transferred your pack fee, record it below.
                    </p>
                  )}
                  {payments.map((p) => (
                    <div key={p.id} className="rounded-md border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-muted-foreground" />{p.label}</span>
                        <span className="font-medium">{inr(Number(p.amount))}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.method ?? p.kind} · {p.reference ?? "—"}</span>
                        <Badge variant={p.status === "paid" ? "default" : p.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">
                          {p.status === "pending_confirmation" ? "awaiting confirmation" : p.status}
                          {p.due_date && p.status === "pending" ? ` · due ${new Date(p.due_date).toLocaleDateString()}` : ""}
                        </Badge>
                      </div>
                      {p.decision_note && (
                        <p className="mt-1 text-xs text-muted-foreground">Note from our team: {p.decision_note}</p>
                      )}
                      {p.status !== "paid" && p.status !== "pending_confirmation" && (
                        <div className="mt-2">
                          <PortalPayDialog
                            recordId={current.id}
                            charge={{ id: p.id, label: p.label, amount: Number(p.amount) }}
                            trigger={<Button size="sm" variant="outline">I've paid this</Button>}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="pt-1">
                    <PortalPayDialog recordId={current.id} />
                  </div>
                  </TabsContent>


                  <TabsContent value="verify" className="mt-3 space-y-2">
                    {verifications.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No identity or document checks have been run on this application yet. Upload the requested
                        documents and our team will run the checks — the result appears here.
                      </p>
                    )}
                    {verifications.map((v) => (
                      <div key={v.id} className="rounded-md border p-2.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            {VERIFICATION_LABELS[v.kind as keyof typeof VERIFICATION_LABELS] ?? v.kind.toUpperCase()}
                          </span>
                          <Badge
                            className={`text-[10px] ${
                              v.status === "verified"
                                ? "bg-green-500/15 text-green-600"
                                : v.status === "failed"
                                  ? "bg-destructive/15 text-destructive"
                                  : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {v.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{v.identifier_masked ?? v.subject_name ?? v.provider}</span>
                          <span>
                            {v.score != null ? `score ${v.score} · ` : ""}
                            {new Date(v.created_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                        {v.error && <div className="mt-1 text-xs text-destructive">{v.error}</div>}
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </>
            )}

          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Apply to another pack</CardTitle>
          <CardDescription>Start a new application in any DigiCRM industry pack — the form is built from that pack&apos;s own fields.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {myPacks.slice(0, 12).map((p) => (
            <Button key={`${p.group}::${p.slug}`} asChild variant="outline" size="sm">
              <Link to="/portal/apply/$group/$slug" params={{ group: p.group, slug: p.slug }}>
                <Plus className="mr-1 h-3.5 w-3.5" />{p.name}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Looking for the internal pipeline? <Button asChild variant="link" size="sm" className="px-1"><Link to="/packs">Industry packs</Link></Button>
      </div>

    </div>
  );
}
