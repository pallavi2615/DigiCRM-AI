import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PACK_GROUPS, type IndustryPack } from "@/lib/industry-packs";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { useAllPacks } from "@/lib/pack-config";
import { ArrowRight, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/packs/")({
  component: PacksIndex,
  head: () => ({
    meta: [
      { title: "Industry Workspaces | DigiCRM AI" },
      { name: "description", content: "Open an industry pack workspace — each with its own stages, fields, KPIs, AI agents and verification checks." },
    ],
  }),
});

function PacksIndex() {
  const { packs } = useAllPacks();
  const groups: Array<{ slug: string; name: string; packs: IndustryPack[] }> = (PACK_GROUPS as readonly string[]).map((gs) => ({
    slug: gs,
    name: INDUSTRY_GROUPS.find((x) => x.slug === gs)?.name ?? gs,
    packs: packs.filter((p) => p.group === gs),
  }));

  const { data: counts = {} } = useQuery({
    queryKey: ["pack-record-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("pack_records").select("pack_slug").is("deleted_at", null);
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.pack_slug] = (map[r.pack_slug] ?? 0) + 1;
      return map;
    },
  });

  return (
    <div className="p-6 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-widest">
          <Layers className="h-4 w-4" /> Industry packs
        </div>
        <h1 className="text-2xl font-bold">Industry workspaces</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          One CRM, configured per vertical. Each pack renames the deal object, ships its own pipeline stages,
          fields, KPIs, AI agents and DigiVerify checks.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.slug} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {g.packs.map((p) => (
              <Link key={p.slug} to="/packs/$group/$slug" params={{ group: p.group, slug: p.slug }}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between gap-2">
                      <span>{p.name}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.tagline}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px]">{p.recordLabelPlural}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.stages.length} stages</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.agents.length} AI agents</Badge>
                      <Badge variant="outline" className="text-[10px]">{counts[p.slug] ?? 0} records</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
