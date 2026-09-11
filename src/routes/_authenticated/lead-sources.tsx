import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIndustryAccess } from "@/lib/industry-access";
import { INDUSTRY_PACKS } from "@/lib/industry-packs";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Radio, TrendingUp, IndianRupee, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lead-sources")({
  head: () => ({
    meta: [
      { title: "Lead Sources, Channels & Campaigns | DigiCRM AI" },
      { name: "description", content: "Track every inbound lead from Google Sheets, Meta Lead Ads and Zapier through its channel, campaign, pipeline stage and revenue." },
      { property: "og:title", content: "Lead Sources | DigiCRM AI" },
      { property: "og:description", content: "Channel and campaign attribution with stage-by-stage conversion and revenue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadSourcesPage,
});

const KINDS = ["manual", "google_sheets", "meta", "zapier", "website", "referral", "affiliate"];
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

interface Channel {
  id: string; name: string; slug: string; kind: string;
  default_group_slug: string | null; default_pack_slug: string | null;
  monthly_cost: number | null; is_active: boolean;
}
interface Campaign {
  id: string; name: string; code: string; channel_id: string | null;
  budget: number | null; is_active: boolean;
}
interface Conversion {
  id: string; channel_id: string | null; campaign_id: string | null;
  industry_group: string | null; stage: string; status: string; revenue: number; occurred_at: string;
}

function LeadSourcesPage() {
  const { isManager } = useAuth();
  const { unrestricted, groups } = useIndustryAccess();
  const qc = useQueryClient();

  const { data: channels = [] } = useQuery({
    queryKey: ["lead-channels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_channels").select("*").order("name");
      if (error) throw error;
      return data as unknown as Channel[];
    },
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["lead-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Campaign[];
    },
  });
  const { data: conversions = [] } = useQuery({
    queryKey: ["lead-conversions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_conversions").select("*").order("occurred_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return data as unknown as Conversion[];
    },
  });

  const visible = useMemo(
    () => conversions.filter((c) => unrestricted || !c.industry_group || groups.includes(c.industry_group)),
    [conversions, unrestricted, groups],
  );

  const perChannel = useMemo(() => {
    return channels.map((ch) => {
      const rows = visible.filter((c) => c.channel_id === ch.id);
      const won = rows.filter((r) => r.status === "won");
      const revenue = won.reduce((s, r) => s + Number(r.revenue || 0), 0);
      return {
        channel: ch,
        leads: rows.length,
        won: won.length,
        lost: rows.filter((r) => r.status === "lost").length,
        rate: rows.length ? (won.length / rows.length) * 100 : 0,
        revenue,
      };
    });
  }, [channels, visible]);

  const stageBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const c of visible) {
      const cur = map.get(c.stage) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(c.revenue || 0);
      map.set(c.stage, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [visible]);

  const totals = useMemo(() => {
    const won = visible.filter((c) => c.status === "won");
    return {
      leads: visible.length,
      won: won.length,
      revenue: won.reduce((s, r) => s + Number(r.revenue || 0), 0),
      rate: visible.length ? (won.length / visible.length) * 100 : 0,
    };
  }, [visible]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Radio className="h-7 w-7 text-primary" /> Lead Sources</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every inbound lead from Google Sheets, Meta Lead Ads or Zapier, tracked to its channel, campaign, stage and revenue.
          </p>
        </div>
        {isManager && <NewChannelDialog onDone={() => qc.invalidateQueries({ queryKey: ["lead-channels"] })} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Radio className="h-4 w-4" />} label="Tracked leads" value={String(totals.leads)} />
        <Kpi icon={<Target className="h-4 w-4" />} label="Converted" value={String(totals.won)} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Conversion rate" value={`${totals.rate.toFixed(1)}%`} />
        <Kpi icon={<IndianRupee className="h-4 w-4" />} label="Attributed revenue" value={money(totals.revenue)} />
      </div>

      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="stages">Stage funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Channel performance</CardTitle>
              <CardDescription>Leads, conversion rate and revenue per acquisition channel.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead><TableHead>Type</TableHead><TableHead>Lands in</TableHead>
                    <TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perChannel.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-muted-foreground text-center py-8">No channels yet.</TableCell></TableRow>
                  )}
                  {perChannel.map((r) => (
                    <TableRow key={r.channel.id}>
                      <TableCell className="font-medium">{r.channel.name}</TableCell>
                      <TableCell><Badge variant="secondary">{r.channel.kind.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {r.channel.default_pack_slug ? `${r.channel.default_group_slug} / ${r.channel.default_pack_slug}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{r.leads}</TableCell>
                      <TableCell className="text-right">{r.won}</TableCell>
                      <TableCell className="text-right">{r.rate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{money(r.revenue)}</TableCell>
                      <TableCell className="text-right">{money(Number(r.channel.monthly_cost ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Campaigns</CardTitle>
                <CardDescription>Campaign-level leads, conversions and revenue.</CardDescription>
              </div>
              {isManager && (
                <NewCampaignDialog channels={channels} onDone={() => qc.invalidateQueries({ queryKey: ["lead-campaigns"] })} />
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead><TableHead>Code</TableHead><TableHead>Channel</TableHead>
                    <TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center py-8">No campaigns yet.</TableCell></TableRow>
                  )}
                  {campaigns.map((c) => {
                    const rows = visible.filter((v) => v.campaign_id === c.id);
                    const won = rows.filter((r) => r.status === "won");
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.code}</TableCell>
                        <TableCell>{channels.find((ch) => ch.id === c.channel_id)?.name ?? "—"}</TableCell>
                        <TableCell className="text-right">{rows.length}</TableCell>
                        <TableCell className="text-right">{won.length}</TableCell>
                        <TableCell className="text-right">{money(won.reduce((s, r) => s + Number(r.revenue || 0), 0))}</TableCell>
                        <TableCell className="text-right">{money(Number(c.budget ?? 0))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Where inbound leads sit</CardTitle>
              <CardDescription>Current pipeline stage of every tracked inbound lead.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stageBreakdown.length === 0 && <p className="text-muted-foreground text-sm">No tracked leads yet.</p>}
              {stageBreakdown.map(([stage, s]) => {
                const pct = totals.leads ? (s.count / totals.leads) * 100 : 0;
                return (
                  <div key={stage}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{stage}</span>
                      <span className="text-muted-foreground">{s.count} · {money(s.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full gradient-primary" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">{icon}{label}</div>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function NewChannelDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("manual");
  const [group, setGroup] = useState<string>("none");
  const [pack, setPack] = useState<string>("none");
  const [cost, setCost] = useState("0");

  const packOptions = INDUSTRY_PACKS.filter((p) => p.group === group);

  const save = useMutation({
    mutationFn: async () => {
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { error } = await supabase.from("lead_channels").insert({
        name, slug, kind,
        default_group_slug: group === "none" ? null : group,
        default_pack_slug: pack === "none" ? null : pack,
        monthly_cost: Number(cost) || 0,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Channel added"); setOpen(false); setName(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New channel</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New lead channel</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Facebook Lead Ads" /></div>
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry</Label>
              <Select value={group} onValueChange={(v) => { setGroup(v); setPack("none"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {INDUSTRY_GROUPS.map((g) => <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pack</Label>
              <Select value={pack} onValueChange={setPack} disabled={group === "none"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {packOptions.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Monthly cost (₹)</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>Save channel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCampaignDialog({ channels, onDone }: { channels: Channel[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState<string>(channels[0]?.id ?? "");
  const [budget, setBudget] = useState("0");

  const save = useMutation({
    mutationFn: async () => {
      const code = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const { error } = await supabase.from("lead_campaigns").insert({
        name, code, channel_id: channelId || null, budget: Number(budget) || 0,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Campaign added"); setOpen(false); setName(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" /> New campaign</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Business Loan" /></div>
          <div>
            <Label>Channel</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
              <SelectContent>{channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Budget (₹)</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!name || save.isPending}>Save campaign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
