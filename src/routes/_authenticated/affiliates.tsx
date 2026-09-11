import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AffiliateSettingsCard } from "@/components/affiliate-settings-card";
import { AffiliatePayoutQueue } from "@/components/affiliate-payout-queue";

import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Users, Check, X, Pencil, Trash2, Download, Copy, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { downloadCsv, objectsToCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/affiliates")({
  head: () => ({ meta: [{ title: "Affiliates — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="affiliates" label="Affiliates">
      <AffiliatesAdmin />
    </RoleGuard>
  ),
});

type Affiliate = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  audience: string | null;
  status: string;
  commission_pct: number;
  referral_code: string | null;
  notes: string | null;
  approved_at: string | null;
  created_at: string;
};

function AffiliatesAdmin() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  useRealtimeTable("affiliates", [["affiliates-admin"]]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Affiliate | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["affiliates-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("id, name, email, company, audience, status, commission_pct, referral_code, notes, approved_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Affiliate[];
    },
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.company?.toLowerCase().includes(q) ||
        r.referral_code?.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const update = useMutation({
    mutationFn: async (v: { id: string; status?: string; commission_pct?: number; referral_code?: string | null; notes?: string | null; name?: string; email?: string }) => {
      const patch: {
        status?: string; commission_pct?: number; referral_code?: string | null;
        notes?: string | null; approved_at?: string;
      } = {};
      if (v.status !== undefined) patch.status = v.status;
      if (v.commission_pct !== undefined) patch.commission_pct = v.commission_pct;
      if (v.referral_code !== undefined) patch.referral_code = v.referral_code;
      if (v.notes !== undefined) patch.notes = v.notes;
      if (v.status === "approved") {
        patch.approved_at = new Date().toISOString();
        if (!v.referral_code) patch.referral_code = suggestCode(v.name || v.email || "REF");
      }
      const { error } = await supabase.from("affiliates").update(patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["affiliates-admin"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("affiliates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["affiliates-admin"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <Card className="max-w-lg mx-auto mt-16">
        <CardContent className="p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Admin access required</h2>
          <p className="text-sm text-muted-foreground">
            The affiliate management console is available to Admins and Super Admins.
          </p>
        </CardContent>
      </Card>
    );
  }

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  const exportCsv = () => {
    const headers = ["name","email","company","audience","status","commission_pct","referral_code","created_at"];
    const csv = objectsToCsv(filtered.map((r) => ({
      name: r.name, email: r.email, company: r.company ?? "",
      audience: r.audience ?? "",
      status: r.status, commission_pct: r.commission_pct,
      referral_code: r.referral_code ?? "", created_at: r.created_at,
    })), headers);
    downloadCsv(`affiliates-${new Date().toISOString().slice(0,10)}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="h-6 w-6" /> Affiliate Partners</h1>
          <p className="text-sm text-muted-foreground mt-1">Review applications, approve partners, and manage commission tiers.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <AffiliateSettingsCard />

      <AffiliatePayoutQueue />


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["all","pending","approved","rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border p-4 text-left transition ${statusFilter === s ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
          >
            <div className="text-xs uppercase text-muted-foreground">{s}</div>
            <div className="text-2xl font-semibold mt-1">{counts[s]}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name, email, company, code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Referral code</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No applications yet.</TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell>
                      <div>{r.company ?? "—"}</div>
                    </TableCell>
                    <TableCell>{r.audience ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.commission_pct}%</TableCell>
                    <TableCell>
                      {r.referral_code ? (
                        <button
                          onClick={() => { navigator.clipboard.writeText(r.referral_code!); toast.success("Copied"); }}
                          className="font-mono text-xs bg-muted px-2 py-1 rounded inline-flex items-center gap-1 hover:bg-muted/70"
                        >
                          {r.referral_code} <Copy className="h-3 w-3" />
                        </button>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: "approved", name: r.name, email: r.email, referral_code: r.referral_code })}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {r.status !== "rejected" && (
                          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: r.id, status: "rejected" })}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" asChild title="View referrals">
                          <Link to="/affiliates/$id/referrals" params={{ id: r.id }}><TrendingUp className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete this affiliate?")) del.mutate(r.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <EditDialog affiliate={editing} onClose={() => setEditing(null)} onSave={(patch) => update.mutate({ id: editing.id, ...patch })} saving={update.isPending} />
      )}
    </div>
  );
}

function EditDialog({ affiliate, onClose, onSave, saving }: {
  affiliate: Affiliate;
  onClose: () => void;
  onSave: (v: Partial<Affiliate>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    status: affiliate.status,
    commission_pct: affiliate.commission_pct,
    referral_code: affiliate.referral_code ?? "",
    notes: affiliate.notes ?? "",
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {affiliate.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Commission %</Label>
            <Input type="number" min={0} max={100} value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Referral code</Label>
            <Input value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })} placeholder="Auto-generated on approval" />
          </div>
          <div>
            <Label>Admin notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function suggestCode(seed: string) {
  const base = seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  return `${base}${Math.floor(Math.random() * 900 + 100)}`;
}
