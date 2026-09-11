import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runVerification, type VerifyKind, type VerifyResult } from "@/lib/verify.functions";
import { VERIFICATION_LABELS } from "@/lib/industry-packs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2, FileSearch, CreditCard, Building2, Landmark, Fingerprint, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/digiverify")({
  component: DigiVerifyPage,
  head: () => ({
    meta: [
      { title: "DigiVerify — Identity & Financial Checks | DigiCRM AI" },
      { name: "description", content: "Run PAN, Aadhaar, GST, bank account, document OCR and credit bureau checks from inside the CRM." },
    ],
  }),
});

const KINDS: Array<{ kind: VerifyKind; icon: typeof ShieldCheck; blurb: string }> = [
  { kind: "pan", icon: CreditCard, blurb: "Live PAN report — holder name, status, Aadhaar seeding and category." },
  { kind: "aadhaar", icon: Fingerprint, blurb: "Live UIDAI validation on top of the Verhoeff checksum. Only the last four digits are stored." },
  { kind: "gst", icon: Building2, blurb: "Live GSTIN advanced verification — legal name, status, addresses and filings." },
  { kind: "bank_account", icon: Landmark, blurb: "Live account verification plus bank and branch lookup from the IFSC directory." },
  { kind: "document_ocr", icon: FileSearch, blurb: "AI reads an ID card, cheque or bank statement and returns structured fields." },
  { kind: "bureau", icon: Gauge, blurb: "Live credit bureau score for the PAN, name and mobile provided." },

];

export default function DigiVerifyPage() {
  const verify = useServerFn(runVerification);
  const qc = useQueryClient();
  const [kind, setKind] = useState<VerifyKind>("pan");
  const [value, setValue] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [mobile, setMobile] = useState("");
  const [subject, setSubject] = useState("");

  const [file, setFile] = useState<{ dataUrl: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<VerifyResult | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["digiverify-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("verifications")
        .select("id, kind, status, provider, score, identifier_masked, subject_name, created_at, error")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const submit = async () => {
    setBusy(true); setLast(null);
    try {
      const res = await verify({
        data: { kind, value, ifsc, mobile: mobile || undefined, subjectName: subject || undefined, fileDataUrl: file?.dataUrl, fileName: file?.name },
      });

      setLast(res);
      if (res.status === "verified") toast.success(`${VERIFICATION_LABELS[kind]} verified`);
      else if (res.status === "manual_review") toast.warning("Needs manual review");
      else toast.error(res.error ?? "Verification failed");
      qc.invalidateQueries({ queryKey: ["digiverify-history"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally { setBusy(false); }
  };

  const active = KINDS.find((k) => k.kind === kind)!;

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <ShieldCheck className="h-4 w-4" /> DigiVerify
        </div>
        <h1 className="text-2xl font-bold">Identity & financial verification</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Run KYC and financial checks without leaving the CRM. Raw identifiers are never stored — only a masked
          reference, the outcome and the structured result, all under your role permissions.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" onClick={() => { setKind(k.kind); setLast(null); }} className="text-left">
            <Card className={k.kind === kind ? "border-primary" : "transition-colors hover:border-primary/40"}>
              <CardContent className="pt-5 space-y-1">
                <div className="flex items-center gap-2 font-medium text-sm"><k.icon className="h-4 w-4" />{VERIFICATION_LABELS[k.kind]}</div>
                <p className="text-xs text-muted-foreground">{k.blurb}</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{VERIFICATION_LABELS[kind]} check</CardTitle></CardHeader>
          <CardContent className="space-y-3">
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
                <Label>{kind === "bureau" ? "PAN" : VERIFICATION_LABELS[kind]}{kind === "bank_account" ? " number" : ""}</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === "pan" || kind === "bureau" ? "ABCDE1234F" : kind === "gst" ? "27ABCDE1234F1Z5" : ""} />
              </div>
            )}
            {kind === "bank_account" && (
              <div className="space-y-1"><Label>IFSC</Label><Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0000001" /></div>
            )}
            {kind === "bureau" && (
              <div className="space-y-1">
                <Label>Mobile (10 digits)</Label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" />
                <p className="text-[11px] text-muted-foreground">Name and mobile are required for a live bureau pull with the applicant&apos;s consent.</p>
              </div>
            )}
            <div className="space-y-1"><Label>Name on record</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>

            <Button className="w-full" onClick={submit} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Run {VERIFICATION_LABELS[kind]} check
            </Button>
            <p className="text-[11px] text-muted-foreground">{active.blurb}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Result</CardTitle></CardHeader>
          <CardContent>
            {last ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={last.status === "verified" ? "default" : last.status === "manual_review" ? "secondary" : "destructive"}>
                    {last.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{last.provider}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{last.masked}</span>
                  {last.score !== null && <Badge variant="secondary">Score {last.score}</Badge>}
                </div>
                {last.error && <p className="text-sm text-destructive">{last.error}</p>}
                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(last.result, null, 2)}</pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run a check to see the structured result here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Verification history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead><TableHead>Subject</TableHead><TableHead>Identifier</TableHead>
                <TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead><TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No checks yet.</TableCell></TableRow>}
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-sm">{VERIFICATION_LABELS[h.kind as VerifyKind] ?? h.kind}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.subject_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{h.identifier_masked}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.provider}</TableCell>
                  <TableCell>
                    <Badge variant={h.status === "verified" ? "default" : h.status === "manual_review" ? "secondary" : "destructive"} className="text-[10px]">
                      {h.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{h.score ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
