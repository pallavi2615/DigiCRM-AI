import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Sparkles } from "lucide-react";
import { buildRouteMeta } from "@/lib/seo";
import { usePlanFeatures } from "@/lib/plan";
import { useMemo } from "react";

export const Route = createFileRoute("/pricing")({
  head: () => buildRouteMeta({
    path: "/pricing",
    title: "Pricing — DigiCRM AI Lite & Prime",
    description: "Two plans. Start with Lite for free-forever essentials, upgrade to Prime for tickets, white-labeling, AI, and inbound automation.",
  }),
  component: PricingPage,
});

const plans = [
  {
    key: "lite",
    name: "Lite",
    price: "$0",
    period: "free forever",
    cta: "Start free",
    icon: Sparkles,
    tagline: "Everything a small team needs to run a modern CRM.",
    ctaLink: "/auth",
  },
  {
    key: "prime",
    name: "Prime",
    price: "$49",
    period: "per user / month",
    cta: "Start 14-day trial",
    icon: Crown,
    featured: true,
    tagline: "Full CRM + Freshdesk-style ticketing, white-labeling, AI & inbound automation.",
    ctaLink: "/auth",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "annual contract",
    cta: "Talk to sales",
    icon: Crown,
    tagline: "Prime plus SSO, dedicated CSM, custom SLAs and audits.",
    ctaLink: "/contact",
  },
];

const FEATURE_GROUPS: { label: string; keys: string[] }[] = [
  { label: "CRM", keys: ["core.leads", "core.contacts", "core.pipeline", "core.tasks", "core.calendar"] },
  { label: "Ticketing (Freshdesk-style)", keys: ["tickets.core", "tickets.canned_responses", "tickets.macros", "tickets.sla", "tickets.automation", "tickets.portal"] },
  { label: "AI & Automation", keys: ["ai.assistant", "ai.proposals", "automation.workflows"] },
  { label: "White-labeling", keys: ["whitelabel.branding", "whitelabel.landing_page", "whitelabel.custom_domain"] },
  { label: "Inbound Leads", keys: ["inbound.webhooks", "inbound.google_sheets", "inbound.facebook"] },
  { label: "Governance", keys: ["governance.audit_logs", "governance.rbac_advanced"] },
];

function PricingPage() {
  const { data: features = [], isLoading } = usePlanFeatures();

  const matrix = useMemo(() => {
    const map: Record<string, { lite: boolean; prime: boolean; description: string }> = {};
    for (const f of features) {
      map[f.feature_key] ??= { lite: false, prime: false, description: f.description ?? "" };
      map[f.feature_key][f.plan] = f.enabled;
      if (f.description) map[f.feature_key].description = f.description;
    }
    return map;
  }, [features]);

  return (
    <SiteShell>
      <section className="py-20 px-6 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Lite for free. Prime when you scale.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every tenant workspace starts on Lite. Upgrade individual workspaces to Prime for tickets, white-labeling, AI and inbound automation — no complex tiers.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {plans.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.key}
                className={`rounded-2xl border p-8 relative ${p.featured ? "border-primary/60 shadow-elegant bg-card ring-1 ring-primary/40" : "border-border/60 bg-card"}`}>
                {p.featured && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>}
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${p.featured ? "text-amber-500" : "text-muted-foreground"}`} />
                  <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{p.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{p.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">/ {p.period}</span>
                </div>
                <Button asChild className="w-full mt-6" variant={p.featured ? "default" : "outline"}>
                  <Link to={p.ctaLink}>{p.cta}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-16 px-6 border-t bg-muted/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center" style={{ fontFamily: "var(--font-display)" }}>Compare plans</h2>
          <p className="text-center text-sm text-muted-foreground mt-2">Configured live from our feature matrix{isLoading ? "…" : ""}.</p>
          <div className="mt-10 border rounded-xl overflow-hidden bg-card">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="bg-muted/30 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground border-b">
                  {group.label}
                </div>
                {group.keys.map((k) => {
                  const row = matrix[k];
                  return (
                    <div key={k} className="px-4 py-3 grid grid-cols-[1fr_80px_80px] items-center gap-4 border-b last:border-b-0 text-sm">
                      <div>
                        <div className="font-medium">{row?.description || k}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{k}</div>
                      </div>
                      <div className="text-center">{row?.lite ? <Check className="h-4 w-4 text-success inline" /> : <X className="h-4 w-4 text-muted-foreground/50 inline" />}</div>
                      <div className="text-center">{row?.prime ? <Check className="h-4 w-4 text-success inline" /> : <X className="h-4 w-4 text-muted-foreground/50 inline" />}</div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="px-4 py-3 grid grid-cols-[1fr_80px_80px] items-center gap-4 bg-muted/20 text-xs uppercase text-muted-foreground">
              <div>Plan</div>
              <div className="text-center">Lite</div>
              <div className="text-center">Prime</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4">Pricing FAQ</Badge>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Answers, before you ask.</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "Is Lite really free forever?", a: "Yes — Lite is free for unlimited users on core CRM (leads, contacts, pipeline, tasks, calendar). We only charge for the Prime capabilities you turn on per workspace." },
              { q: "Can different workspaces be on different plans?", a: "Absolutely. Each tenant workspace has its own plan, so an agency can run one Prime workspace for a big client and Lite for their internal team." },
              { q: "What happens to my data if I downgrade?", a: "Nothing is deleted. Prime-only features (tickets, white-label landing pages, AI, inbound webhooks) become read-only until you upgrade again." },
              { q: "Do you offer non-profit or student discounts?", a: "Yes — 50% off Prime for verified non-profits and educational institutions. Reach out from the Contact page." },
              { q: "Is there a setup fee?", a: "Never. Migrate your own data with the CSV importer, or ask us for a white-glove migration on Enterprise." },
            ].map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card p-5 open:shadow-elegant">
                <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-primary text-xl leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 text-center border-t bg-gradient-to-b from-transparent to-primary/5">
        <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Try Prime free for 14 days.</h2>
        <p className="mt-3 text-muted-foreground max-w-md mx-auto">No credit card. Cancel anytime. Keep all your data if you decide to stay on Lite.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Start free trial</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/contact">Talk to sales</Link></Button>
        </div>
      </section>
    </SiteShell>
  );
}
