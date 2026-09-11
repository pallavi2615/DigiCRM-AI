import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getIndustry, CORE_FEATURES } from "@/lib/industries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Inbox, Users, TrendingUp, Target, IndianRupee, Handshake, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/industry/$slug/")({
  head: ({ params }) => {
    const preset = getIndustry(params.slug);
    return {
      meta: [
        { title: `${preset?.name ?? "Industry"} overview — DigiCRM AI` },
        { name: "description", content: `Pipeline, conversion and revenue at a glance for ${preset?.name ?? "this industry"}.` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => (
    <p className="p-10 text-center text-sm text-muted-foreground">Unable to load this overview. Please try again.</p>
  ),
  component: IndustryOverview,
});

function IndustryOverview() {
  const { slug } = Route.useParams();
  const preset = getIndustry(slug)!;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["industry-leads", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, contact_person, email, status, estimated_value, created_at, industry")
        .eq("industry", preset.name)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kpiQuery = useQuery({
    queryKey: ["industry-kpis", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, status, estimated_value, created_at")
        .eq("industry", preset.name)
        .is("deleted_at", null)
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = kpiQuery.data ?? [];
  const leadIds = all.map((l) => l.id as string);

  const proposalQuery = useQuery({
    queryKey: ["industry-proposals", slug, leadIds.length],
    enabled: leadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, value, stage, approval_status, converted_at, lead_id")
        .in("lead_id", leadIds.slice(0, 500))
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const props = proposalQuery.data ?? [];
  const proposalCount = props.length;
  const proposalsConverted = props.filter((p) => p.converted_at || p.stage === "accepted").length;
  const proposalConversion = proposalCount ? Math.round((proposalsConverted / proposalCount) * 100) : 0;
  const avgProposalValue = proposalCount
    ? Math.round(props.reduce((s, p) => s + Number(p.value ?? 0), 0) / proposalCount)
    : 0;
  const proposalsAwaiting = props.filter((p) => p.approval_status === "pending").length;
  const proposalsLoading = proposalQuery.isLoading;

  const byStatus = all.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});
  const won = byStatus["won"] ?? 0;
  const lost = byStatus["lost"] ?? 0;
  const open = all.length - won - lost;
  const pipelineValue = all
    .filter((l) => l.status !== "won" && l.status !== "lost")
    .reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const wonValue = all
    .filter((l) => l.status === "won")
    .reduce((s, l) => s + Number(l.estimated_value ?? 0), 0);
  const conversion = all.length ? Math.round((won / all.length) * 100) : 0;
  const avgDeal = won ? Math.round(wonValue / won) : 0;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const newThisMonth = all.filter((l) => new Date(l.created_at as string) >= monthStart).length;
  const kpiLoading = kpiQuery.isLoading;
  const leads = data ?? [];

  return (
    <div className="space-y-5">
      {kpiQuery.isError && (
        <p className="text-sm text-destructive">Unable to load KPIs for this workspace. Please try again.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total leads", icon: Users, value: all.length.toLocaleString(), sub: `${newThisMonth} added this month` },
          { label: "Open deals", icon: Target, value: open.toLocaleString(), sub: `${won} won · ${lost} lost` },
          { label: "Pipeline value", icon: IndianRupee, value: `₹${pipelineValue.toLocaleString()}`, sub: `₹${wonValue.toLocaleString()} won` },
          { label: "Conversion", icon: TrendingUp, value: `${conversion}%`, sub: avgDeal ? `₹${avgDeal.toLocaleString()} avg deal` : "No closed deals yet" },
        ].map((k) => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{kpiLoading ? <Skeleton className="h-7 w-20" /> : k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpiLoading ? <Skeleton className="h-3 w-24" /> : k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Proposals", icon: FileText, value: proposalCount.toLocaleString(), sub: `${proposalsAwaiting} awaiting approval` },
          { label: "Proposal conversion", icon: TrendingUp, value: `${proposalConversion}%`, sub: `${proposalsConverted} became deals` },
          { label: "Avg proposal value", icon: IndianRupee, value: `₹${avgProposalValue.toLocaleString()}`, sub: "Across all proposals" },
          { label: "Avg won deal value", icon: Handshake, value: `₹${avgDeal.toLocaleString()}`, sub: `${won} deals won` },
        ].map((k) => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{proposalsLoading ? <Skeleton className="h-7 w-20" /> : k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{proposalsLoading ? <Skeleton className="h-3 w-24" /> : k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Deals by stage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {kpiLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            {!kpiLoading && all.length === 0 && (
              <p className="text-sm text-muted-foreground">No lead data yet for this industry.</p>
            )}
            {!kpiLoading && all.length > 0 &&
              (["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"] as const).map((st) => {
                const count = byStatus[st] ?? 0;
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize">{st.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <Progress value={all.length ? (count / all.length) * 100 : 0} className="h-1.5" />
                  </div>
                );
              })}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Industry pipeline stages</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {preset.stages.map((s, i) => (
              <Badge key={s} variant="outline" className="gap-1.5">
                <span className="text-muted-foreground">{i + 1}</span> {s}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Latest leads in this industry</CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link to="/industry/$slug/$section" params={{ slug, section: "leads" }}>All leads</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>}
          {isError && <p className="text-sm text-destructive">Unable to load leads. Please try again.</p>}
          {!isLoading && !isError && leads.length === 0 && (
            <div className="text-center py-10">
              <Inbox className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No leads tagged with “{preset.name}” yet.</p>
              <Button asChild size="sm" className="mt-3"><Link to="/leads">Create the first lead</Link></Button>
            </div>
          )}
          {!isLoading && leads.length > 0 && (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Company</TableHead><TableHead>Contact</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Value</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.company_name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.contact_person ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{l.status}</Badge></TableCell>
                    <TableCell className="text-right">{l.estimated_value ? `₹${Number(l.estimated_value).toLocaleString()}` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Included in every industry workspace</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {CORE_FEATURES.map(f => (
            <div key={f.title} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
