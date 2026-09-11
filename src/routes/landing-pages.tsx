import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildRouteMeta } from "@/lib/seo";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { Sparkles, Palette, Globe, Webhook, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/landing-pages")({
  head: () => buildRouteMeta({
    path: "/landing-pages",
    title: "White-label landing pages — DigiCRM AI",
    description: "Generate industry-specific, branded landing pages for every tenant workspace, with lead forms wired directly to your CRM.",
  }),
  component: LandingPagesShowcase,
});

function LandingPagesShowcase() {
  return (
    <SiteShell>
      <section className="py-20 px-6 border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">White-label</Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            One-click landing pages, per workspace.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every tenant gets their own branded landing page and support portal. Choose an industry template, drop in colors and a logo, and share the public URL — leads flow straight into the CRM.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/pricing">See Prime plans</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/contact">Book a demo</Link></Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            { icon: Palette, title: "Your brand", desc: "Custom logo, primary/accent colors, tagline, favicon — no CSS required." },
            { icon: Globe, title: "Public URL & domain", desc: "Instant /t/your-slug URL. Bring your own domain (Prime) for a fully white-labeled experience." },
            { icon: Webhook, title: "Leads → CRM", desc: "The embedded form writes straight into your leads table with proper source attribution." },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 bg-muted/10 border-t">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center" style={{ fontFamily: "var(--font-display)" }}>Industry templates</h2>
          <p className="text-center text-sm text-muted-foreground mt-2">Generate a full landing page from any template in seconds.</p>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {INDUSTRY_TEMPLATES.map((t) => (
              <Card key={t.slug} className="group hover:border-primary/40 transition">
                <CardContent className="p-5">
                  <Badge variant="outline" className="mb-2">{t.industry}</Badge>
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.hero_subheadline}</p>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {t.features.slice(0, 3).map((f) => (
                      <li key={f.title} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" /> {f.title}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t text-center">
        <div className="max-w-2xl mx-auto">
          <Sparkles className="h-10 w-10 mx-auto text-primary" />
          <h2 className="text-3xl font-bold mt-4" style={{ fontFamily: "var(--font-display)" }}>Ready to launch?</h2>
          <p className="text-muted-foreground mt-2">Create your first tenant and go live in under 60 seconds.</p>
          <Button asChild size="lg" className="mt-6"><Link to="/auth">Get started free</Link></Button>
        </div>
      </section>
    </SiteShell>
  );
}
