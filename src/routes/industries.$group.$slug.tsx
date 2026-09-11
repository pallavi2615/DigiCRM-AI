import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles, Users, Bot, LayoutGrid, BarChart3 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getSubIndustry } from "@/lib/industry-taxonomy";
import { PRODUCTS } from "@/lib/products";
import { INDUSTRY_PACKS } from "@/lib/industry-packs";
import { buildRouteMeta, breadcrumbJsonLd, absoluteUrl } from "@/lib/seo";

export const Route = createFileRoute("/industries/$group/$slug")({
  loader: ({ params }) => {
    const found = getSubIndustry(params.group, params.slug);
    if (!found) throw notFound();
    return found;
  },
  head: ({ loaderData, params }) => {
    const path = `/industries/${params.group}/${params.slug}`;
    const sub = loaderData?.sub;
    if (!sub)
      return buildRouteMeta({ path, title: "Industry not found — DigiCRM AI", description: "This industry pack isn't available.", noindex: true });
    const title = `${sub.name} CRM — ${sub.tagline} | DigiCRM AI`;
    return buildRouteMeta({
      path,
      title,
      description: sub.description,
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Industries", path: "/industries" },
          { name: loaderData!.group.name, path: `/industries/${params.group}` },
          { name: sub.name, path },
        ]),
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${sub.name} CRM by DigiCRM AI`,
          description: sub.description,
          url: absoluteUrl(path),
          brand: { "@type": "Brand", name: "DigiCRM AI" },
        },
      ],
    });
  },
  component: SubIndustryPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold">Industry pack not found</h1>
        <Button asChild className="mt-6"><Link to="/industries">Browse industries</Link></Button>
      </div>
    </SiteShell>
  ),
});

function SubIndustryPage() {
  const { group, sub } = Route.useLoaderData();
  const Icon = (LucideIcons as unknown as Record<string, typeof Sparkles>)[group.icon] ?? Sparkles;
  const siblings = group.children.filter((c) => c.slug !== sub.slug);
  const hasPack = INDUSTRY_PACKS.some((p) => p.group === group.slug && p.slug === sub.slug);


  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: group.gradient }} />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-16">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Link to="/industries" className="hover:text-foreground">Industries</Link>
            <span>/</span>
            <Link to="/industries/$group" params={{ group: group.slug }} className="hover:text-foreground">{group.name}</Link>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: group.gradient }}>
              <Icon className="h-7 w-7" />
            </div>
            {sub.live ? <Badge variant="secondary">Live workspace</Badge> : <Badge variant="outline">Industry pack</Badge>}
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight max-w-3xl" style={{ fontFamily: "var(--font-display)" }}>
            {sub.name} CRM — <span className="bg-clip-text text-transparent" style={{ backgroundImage: group.gradient }}>{sub.tagline}</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-3xl">{sub.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Start free trial <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
            {sub.live && sub.liveHref === "/fintech" && (
              <Button asChild size="lg" variant="outline"><Link to="/fintech">Open the live workspace</Link></Button>
            )}
            {sub.live && sub.liveHref === "/realestate" && (
              <Button asChild size="lg" variant="outline"><Link to="/realestate">Open the live workspace</Link></Button>
            )}
            {sub.live && sub.liveHref === "/it" && (
              <Button asChild size="lg" variant="outline"><Link to="/it">Open the live workspace</Link></Button>
            )}
            {hasPack && (
              <>
                <Button asChild size="lg" variant="outline">
                  <Link to="/packs/$group/$slug" params={{ group: group.slug, slug: sub.slug }}>Open the pack workspace</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/portal/apply/$group/$slug" params={{ group: group.slug, slug: sub.slug }}>Apply in the client portal</Link>
                </Button>
              </>
            )}
            <Button asChild size="lg" variant="ghost"><Link to="/contact">Talk to us</Link></Button>

          </div>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>The {sub.name.toLowerCase()} pipeline</h2>
        <p className="text-muted-foreground mt-2">Stages ship configured — rename, reorder or add your own in settings.</p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {sub.stages.map((st, i) => (
            <div key={st} className="flex items-center gap-2">
              <div className="rounded-xl border bg-card px-4 py-2 text-sm font-medium">{st}</div>
              {i < sub.stages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </section>

      {/* OBJECTS + KPIS */}
      <section className="max-w-6xl mx-auto px-6 pb-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><LayoutGrid className="h-4 w-4 text-primary" /><h3 className="font-bold">Workspace objects</h3></div>
          <div className="flex flex-wrap gap-2">
            {sub.objects.map((o) => (
              <span key={o} className="rounded-full bg-muted px-3 py-1 text-xs">{o}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="h-4 w-4 text-primary" /><h3 className="font-bold">Dashboard KPIs</h3></div>
          <ul className="space-y-2">
            {sub.kpis.map((k) => (
              <li key={k} className="text-sm flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0" /> {k}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* AI AGENTS + PERSONAS */}
      <section className="max-w-6xl mx-auto px-6 pb-14 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Bot className="h-4 w-4 text-primary" /><h3 className="font-bold">AI agents in this pack</h3></div>
          <ul className="space-y-2">
            {sub.agents.map((a) => (
              <li key={a} className="text-sm flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary shrink-0" /> {a}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4"><Users className="h-4 w-4 text-primary" /><h3 className="font-bold">Built for</h3></div>
          <ul className="space-y-2">
            {sub.personas.map((p) => (
              <li key={p} className="text-sm flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary shrink-0" /> {p}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* PLATFORM */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Every pack inherits the full platform</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p) => (
            <Link key={p.slug} to="/products/$slug" params={{ slug: p.slug }} className="rounded-xl border bg-card p-4 hover:shadow-lg transition-all">
              <div className="text-sm font-bold">{p.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.tagline}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      {sub.faq.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 pb-14">
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>Questions</h2>
          <div className="space-y-4">
            {sub.faq.map((f) => (
              <div key={f.q} className="rounded-xl border bg-card p-5">
                <div className="font-medium">{f.q}</div>
                <div className="text-sm text-muted-foreground mt-1.5">{f.a}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SIBLINGS */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>More in {group.name}</h2>
        <div className="flex flex-wrap gap-2">
          {siblings.map((c) => (
            <Link
              key={c.slug}
              to="/industries/$group/$slug"
              params={{ group: group.slug, slug: c.slug }}
              className="rounded-full border px-4 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
