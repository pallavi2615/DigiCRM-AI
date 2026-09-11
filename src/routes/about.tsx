import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ShieldCheck, Zap, Users, Globe, Rocket } from "lucide-react";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () => buildRouteMeta({
    path: "/about",
    title: "About — DigiCRM AI",
    description: "The story, mission and team behind DigiCRM AI — the AI-native CRM built for modern revenue teams.",
  }),
  component: AboutPage,
});

const VALUES = [
  { i: Heart, t: "Sellers first", b: "Every decision starts with the rep: less admin, more selling. If a workflow costs more clicks than it saves, we cut it." },
  { i: ShieldCheck, t: "Governed by default", b: "RLS-first schema, four roles, audit-grade logs. Security isn't a paid tier — it ships in Lite too." },
  { i: Zap, t: "Realtime everything", b: "Pipelines, tickets, dashboards and inboxes update the instant something changes — no refresh, no stale data." },
  { i: Users, t: "Built for teams", b: "From two-person startups to 200-seat sales orgs. Role-scoped views scale with your team." },
  { i: Globe, t: "Multi-tenant by design", b: "One product, unlimited workspaces. Perfect for agencies, partners and franchise networks." },
  { i: Rocket, t: "Shipped weekly", b: "New AI capabilities and industry presets roll out every week. Follow the changelog on the blog." },
];

const TIMELINE = [
  { y: "2024 · Q1", t: "The prototype", b: "First working pipeline + AI proposal writer in a weekend hackathon." },
  { y: "2024 · Q3", t: "Multi-tenant beta", b: "Launched to 40 design partners across fintech, real estate and SaaS." },
  { y: "2025 · Q1", t: "Freshdesk-style tickets", b: "Full ticketing with SLAs, canned responses and a Prime plan." },
  { y: "2025 · Q3", t: "Industry CRMs", b: "Prebuilt CRMs for Fintech DSA, Real Estate, IT and Product Sales." },
  { y: "2026", t: "You?", b: "Join the teams that already ship deals faster with DigiCRM AI." },
];

function AboutPage() {
  return (
    <SiteShell>
      <section className="py-24 px-6 max-w-4xl mx-auto">
        <Badge variant="outline" className="mb-4">Our story</Badge>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          Built for teams that hate CRM admin.
        </h1>
        <div className="mt-8 space-y-6 text-lg text-muted-foreground leading-relaxed">
          <p>DigiCRM AI started with a simple idea: reps should spend time selling, not updating fields. So we built an AI-native CRM where the AI does the admin — drafting outreach, generating proposals, summarizing accounts, and coaching next steps.</p>
          <p>Every feature is opinionated. Every table is RLS-first. Every denied access attempt is captured in the audit log. And every industry — fintech, real estate, IT, product sales — gets a prebuilt CRM tuned to its pipeline.</p>
          <p>We're a small team obsessed with the details revenue teams actually feel: keyboard-first navigation, realtime pipeline updates, and CSV import that just works.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {[
            { k: "2024", v: "Founded" },
            { k: "4 roles", v: "RBAC + RLS" },
            { k: "9 modules", v: "One workspace" },
          ].map(s => (
            <div key={s.k} className="rounded-xl border bg-card p-6">
              <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{s.k}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 border-t bg-muted/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">What we believe</Badge>
            <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Six principles we ship by.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VALUES.map(v => (
              <div key={v.t} className="rounded-xl border bg-card p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <v.i className="h-5 w-5" />
                </div>
                <h3 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{v.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Journey</Badge>
            <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              From weekend prototype to industry-tuned CRM.
            </h2>
          </div>
          <ol className="relative border-l-2 border-primary/20 ml-3 space-y-8">
            {TIMELINE.map(t => (
              <li key={t.y} className="pl-8 relative">
                <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full gradient-primary shadow-elegant" />
                <div className="text-xs uppercase tracking-widest text-primary font-semibold">{t.y}</div>
                <div className="mt-1 text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>{t.t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20 px-6 border-t bg-gradient-to-b from-transparent to-primary/5 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Come build with us.</h2>
          <p className="mt-3 text-muted-foreground">Whether you sell loans, homes, hours or products — there's a DigiCRM AI workspace waiting for your team.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button asChild size="lg"><Link to="/auth">Start free trial</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/contact">Get in touch</Link></Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
