import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { PRODUCTS } from "@/lib/products";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/products/")({
  head: () =>
    buildRouteMeta({
      path: "/products",
      title: "Product suite — CRM, marketing, service, AI & workflows | DigiCRM AI",
      description:
        "DigiCRM, DigiMarketing, DigiSales, DigiService, DigiAI, DigiFlow, DigiVerify and DigiPortal — one AI-native platform, eight products, industry packs on top.",
    }),
  component: ProductsIndex,
});

const statusLabel: Record<string, string> = { live: "Live", beta: "Beta", planned: "Coming soon" };

function ProductsIndex() {
  return (
    <SiteShell>
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-10 text-center">
        <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5">
          <Sparkles className="h-3 w-3 mr-1.5 text-primary" /> {PRODUCTS.length} products, one platform
        </Badge>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>
          The{" "}
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
            AI-native
          </span>{" "}
          revenue platform.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Sales CRM · Marketing Automation · Service CRM · AI Agents · No-Code Workflows · Verification APIs · Field Sales · Customer &amp; Partner
          Portals.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCTS.map((p) => {
          const Icon = (LucideIcons as unknown as Record<string, typeof Sparkles>)[p.icon] ?? Sparkles;
          return (
            <Link
              key={p.slug}
              to="/products/$slug"
              params={{ slug: p.slug }}
              className="group relative rounded-2xl border bg-card p-6 overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="absolute inset-0 opacity-[0.08] group-hover:opacity-20 transition-opacity" style={{ background: p.gradient }} />
              <div className="relative">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white shadow-lg mb-4" style={{ background: p.gradient }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold" style={{ fontFamily: "var(--font-display)" }}>{p.name}</h2>
                  <Badge variant={p.status === "live" ? "secondary" : "outline"} className="text-[10px]">{statusLabel[p.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{p.tagline}</p>
                <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                  Learn more <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Then add your industry pack</h2>
        <p className="text-muted-foreground mt-2">
          The same deal object becomes a Loan Application, a Property Deal or an Admission — with its own fields, stages, KPIs and AI agents.
        </p>
        <Button asChild className="mt-6"><Link to="/industries">Browse industry packs</Link></Button>
      </section>
    </SiteShell>
  );
}
