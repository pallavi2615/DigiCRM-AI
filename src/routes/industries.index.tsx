import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { INDUSTRY_GROUPS, ALL_SUB_INDUSTRIES } from "@/lib/industry-taxonomy";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/industries/")({
  head: () =>
    buildRouteMeta({
      path: "/industries",
      title: "Industries — AI-native CRM for every vertical | DigiCRM AI",
      description:
        "Industry packs for Financial Services, Property, Commerce, Mobility & Supply Chain, Healthcare, Education, Industrial and Professional Services — one platform, industry-specific workflows.",
    }),
  component: IndustriesIndex,
});

function IndustriesIndex() {
  return (
    <SiteShell>
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-10 text-center">
        <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5">
          <Sparkles className="h-3 w-3 mr-1.5 text-primary" /> {INDUSTRY_GROUPS.length} groups · {ALL_SUB_INDUSTRIES.length} industry packs
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>
          One platform.{" "}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
            Every industry.
          </span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Sales, marketing, service, AI agents, workflows and verification — then an industry pack that changes the terminology, fields, stages,
          KPIs and automations to match how your vertical actually sells.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24 grid gap-6 lg:grid-cols-2">
        {INDUSTRY_GROUPS.map((g) => {
          const Icon = (LucideIcons as unknown as Record<string, typeof Sparkles>)[g.icon] ?? Sparkles;
          return (
            <div key={g.slug} className="group relative rounded-2xl border bg-card p-6 overflow-hidden transition-all hover:shadow-2xl">
              <div className="absolute inset-0 opacity-[0.07]" style={{ background: g.gradient }} />
              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: g.gradient }}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{g.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{g.tagline}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {g.children.map((c) => (
                    <Link
                      key={c.slug}
                      to="/industries/$group/$slug"
                      params={{ group: g.slug, slug: c.slug }}
                      className="rounded-full border bg-background/70 px-3 py-1 text-xs hover:border-primary hover:text-primary transition-colors"
                    >
                      {c.name}
                      {c.live && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-primary">live</span>}
                    </Link>
                  ))}
                </div>
                <Link
                  to="/industries/$group"
                  params={{ group: g.slug }}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:gap-3 transition-all"
                >
                  Explore {g.name} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Don't see your industry?</h2>
        <p className="text-muted-foreground mt-2">
          Industry packs are configuration, not custom code. Tell us your pipeline and we'll spin up a pack for you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Button asChild><Link to="/contact">Request an industry pack</Link></Button>
          <Button asChild variant="outline"><Link to="/products">See the product suite</Link></Button>
        </div>
      </section>
    </SiteShell>
  );
}
