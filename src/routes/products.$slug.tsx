import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { getProduct, PRODUCTS } from "@/lib/products";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { buildRouteMeta, breadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/products/$slug")({
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData, params }) => {
    const path = `/products/${params.slug}`;
    const p = loaderData?.product;
    if (!p) return buildRouteMeta({ path, title: "Product not found — DigiCRM AI", description: "This product isn't available.", noindex: true });
    return buildRouteMeta({
      path,
      title: `${p.name} — ${p.tagline} | DigiCRM AI`,
      description: p.description,
      jsonLd: [
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: p.name, path },
        ]),
      ],
    });
  },
  component: ProductPage,
  notFoundComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold">Product not found</h1>
        <Button asChild className="mt-6"><Link to="/products">See all products</Link></Button>
      </div>
    </SiteShell>
  ),
});

const statusLabel: Record<string, string> = { live: "Live today", beta: "In beta", planned: "On the roadmap" };

function ProductPage() {
  const { product } = Route.useLoaderData();
  const Icon = (LucideIcons as unknown as Record<string, typeof Sparkles>)[product.icon] ?? Sparkles;
  const others = PRODUCTS.filter((p) => p.slug !== product.slug);

  return (
    <SiteShell>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ background: product.gradient }} />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-16">
          <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground">← All products</Link>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: product.gradient }}>
              <Icon className="h-7 w-7" />
            </div>
            <Badge variant={product.status === "live" ? "secondary" : "outline"}>{statusLabel[product.status]}</Badge>
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {product.name}
          </h1>
          <p className="mt-3 text-xl text-muted-foreground">{product.tagline}</p>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">{product.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Get started <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/contact">Book a demo</Link></Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>What's inside</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.capabilities.map((c) => (
            <div key={c} className="rounded-xl border bg-card p-4 text-sm flex items-center gap-2">
              <Check className="h-4 w-4 text-primary shrink-0" /> {c}
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-14">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Tuned per industry</h2>
        <p className="text-muted-foreground mt-2">{product.name} inherits your industry pack's terminology, fields, stages and KPIs.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {INDUSTRY_GROUPS.map((g) => (
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

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>Rest of the suite</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((p) => (
            <Link key={p.slug} to="/products/$slug" params={{ slug: p.slug }} className="rounded-xl border bg-card p-4 hover:shadow-lg transition-all">
              <div className="text-sm font-bold">{p.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.tagline}</div>
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
