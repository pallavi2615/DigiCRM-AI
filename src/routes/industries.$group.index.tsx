import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getGroup, resolveLegacySlug, INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { buildRouteMeta, breadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/industries/$group/")({
  loader: ({ params }) => {
    const group = getGroup(params.group);
    if (!group) {
      // Legacy /industries/<industry-slug> links keep working.
      const legacy = resolveLegacySlug(params.group);
      if (legacy) throw redirect({ to: "/industries/$group/$slug", params: legacy, statusCode: 301 });
      throw notFound();
    }
    return { group };
  },
  head: ({ loaderData, params }) => {
    const g = loaderData?.group;
    const path = `/industries/${params.group}`;
    if (!g)
      return buildRouteMeta({ path, title: "Industry not found — DigiCRM AI", description: "This industry group isn't available.", noindex: true });
    return buildRouteMeta({
      path,
      title: `${g.name} CRM — ${g.tagline} | DigiCRM AI`,
      description: g.description,
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Industries", path: "/industries" },
          { name: g.name, path },
        ]),
      ],
    });
  },
  component: GroupPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold">Industry group not found</h1>
        <Button asChild className="mt-6"><Link to="/industries">Browse industries</Link></Button>
      </div>
    </SiteShell>
  ),
});

function GroupPage() {
  const { group } = Route.useLoaderData();
  const Icon = (LucideIcons as unknown as Record<string, typeof Sparkles>)[group.icon] ?? Sparkles;
  const others = INDUSTRY_GROUPS.filter((g) => g.slug !== group.slug).slice(0, 4);

  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: group.gradient }} />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-14">
          <Link to="/industries" className="text-sm text-muted-foreground hover:text-foreground">← All industries</Link>
          <div className="mt-6 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: group.gradient }}>
              <Icon className="h-7 w-7" />
            </div>
            <Badge variant="outline">{group.children.length} industry packs</Badge>
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {group.name}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">{group.description}</p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {group.children.map((c) => (
          <Link
            key={c.slug}
            to="/industries/$group/$slug"
            params={{ group: group.slug, slug: c.slug }}
            className="group rounded-2xl border bg-card p-6 transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{c.name}</h2>
              {c.live && <Badge variant="secondary" className="text-[10px]">Live</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{c.tagline}</p>
            <ul className="mt-4 space-y-1.5">
              {c.kpis.slice(0, 3).map((k) => (
                <li key={k} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-primary shrink-0" /> {k}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-3 transition-all">
              View pack <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>Other industry groups</h2>
        <div className="flex flex-wrap gap-2">
          {others.map((g) => (
            <Link
              key={g.slug}
              to="/industries/$group"
              params={{ group: g.slug }}
              className="rounded-full border px-4 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors"
            >
              {g.name}
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
