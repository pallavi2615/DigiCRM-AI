import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import infoStack from "@/assets/infographic-stack.jpg";
import infoWorkflow from "@/assets/infographic-workflow.jpg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  KanbanSquare, Bot, Zap, UploadCloud, Search, ScrollText, BarChart3, ShieldCheck,
  FileText, Users, Building2, CheckSquare, Calendar, Bell, Landmark, Home, Laptop, Package,
  Sparkles, ArrowRight, Check,
} from "lucide-react";

import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/features")({
  head: () => buildRouteMeta({
    path: "/features",
    title: "Features — DigiCRM AI",
    description: "AI copilot, visual pipeline, proposals, automation, CSV import, global search, audit logs, RBAC — every DigiCRM AI feature explained.",
  }),
  component: FeaturesPage,
});

const groups = [
  {
    title: "AI copilot & content",
    items: [
      { icon: Bot, name: "AI Assistant", body: "Chat grounded in your pipeline. Drafts, summaries and next-best-action coaching." },
      { icon: FileText, name: "AI Proposals", body: "Client-ready proposals in seconds — export to markdown or send from the app." },
      { icon: Sparkles, name: "Lovable AI Gateway", body: "No API keys to manage. Bring your own model or use our fastest defaults." },
    ],
  },
  {
    title: "Sales workflow",
    items: [
      { icon: Users, name: "Leads & Contacts", body: "Unified inbox for people and companies with dedupe, tags, and owner assignment." },
      { icon: Building2, name: "Companies", body: "Full account view with people, deals, notes and revenue history." },
      { icon: KanbanSquare, name: "Visual Pipeline", body: "Realtime Kanban with drag-and-drop stage changes and revenue forecasting." },
      { icon: CheckSquare, name: "Tasks", body: "Assign, due-date, prioritize — never lose track of a follow-up." },
      { icon: Calendar, name: "Calendar & Meetings", body: "Schedule, log outcomes, and sync context back to the deal." },
    ],
  },
  {
    title: "Operations & governance",
    items: [
      { icon: Zap, name: "Automation", body: "Trigger tasks, notifications and follow-ups on stage, priority or owner changes." },
      { icon: UploadCloud, name: "CSV Import/Export", body: "Bulk migrate leads, contacts and companies with templated field mapping." },
      { icon: Search, name: "Global ⌘K Search", body: "Jump anywhere in the app with one keystroke." },
      { icon: Bell, name: "Notifications", body: "In-app + email alerts for mentions, assignments and stage changes." },
      { icon: ScrollText, name: "Audit Logs", body: "Every change captured with actor, timestamp and field-level diff." },
      { icon: ShieldCheck, name: "RBAC + RLS", body: "Four roles, row-level security, and end-to-end tested authorization." },
      { icon: BarChart3, name: "Reports & Analytics", body: "KPIs, trends, sources and priorities — always in sync with your pipeline." },
    ],
  },
  {
    title: "Industry-tuned CRMs",
    items: [
      { icon: Landmark, name: "Fintech DSA", body: "9-stage loan pipeline with KYC, lender payouts and commission tracking." },
      { icon: Home, name: "Real Estate", body: "Clients, properties, deals & KYC uploads with ownership-enforced RLS." },
      { icon: Laptop, name: "IT Company", body: "Projects, tickets & engagement pipeline for services teams." },
      { icon: Package, name: "Product Sales", body: "Catalog, quotes/orders and automated commissions." },
    ],
  },
];

function FeaturesPage() {
  return (
    <SiteShell>
      <section className="py-20 px-6 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Everything a modern revenue team needs.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            One workspace covers the AI copilot, sales workflow, ops and governance — plus prebuilt CRMs for four industries.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Start free trial <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/pricing">See pricing</Link></Button>
          </div>
        </div>
      </section>
      <section className="py-16 px-6 bg-muted/20 border-b border-border/40">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          <figure className="rounded-2xl overflow-hidden border shadow-card">
            <img src={infoStack} alt="Full DigiCRM feature stack infographic" loading="lazy" className="w-full h-64 object-cover" />
            <figcaption className="p-4 text-sm font-medium">The complete DigiCRM AI stack</figcaption>
          </figure>
          <figure className="rounded-2xl overflow-hidden border shadow-card">
            <img src={infoWorkflow} alt="Automation workflow infographic" loading="lazy" className="w-full h-64 object-cover" />
            <figcaption className="p-4 text-sm font-medium">Automations at every step</figcaption>
          </figure>
        </div>
      </section>
      {groups.map((g) => (
        <section key={g.title} className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: "var(--font-display)" }}>{g.title}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.items.map((f) => (
                <div key={f.name} className="rounded-xl border border-border/60 bg-card p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1.5" style={{ fontFamily: "var(--font-display)" }}>{f.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="py-20 px-6 border-t bg-muted/10">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <Badge variant="outline" className="mb-4">Loved by revenue teams</Badge>
          <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>What customers are saying</h2>
        </div>
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
          {[
            { q: "We cut proposal turnaround from three days to fifteen minutes. The AI writer alone paid for the year.", a: "Priya S.", r: "Head of Sales, fintech" },
            { q: "The pipeline is the fastest we've ever used. Realtime updates mean nobody double-works a deal.", a: "Marcus L.", r: "Sales Director, SaaS" },
            { q: "RLS-first + audit logs finally let us pass SOC-2 without a custom build. Prime paid for itself in month one.", a: "Elena R.", r: "COO, real estate group" },
          ].map(t => (
            <blockquote key={t.a} className="rounded-2xl border bg-card p-6 shadow-card">
              <p className="text-sm leading-relaxed">"{t.q}"</p>
              <footer className="mt-4 pt-4 border-t text-xs">
                <div className="font-semibold">{t.a}</div>
                <div className="text-muted-foreground">{t.r}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="py-16 px-6 text-center border-t border-border/40 bg-muted/30">
        <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>Ready to see it live?</h2>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started free</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/contact">Talk to sales</Link></Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-4">
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> 14-day trial</span>
          <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Cancel anytime</span>
        </p>
      </section>
    </SiteShell>
  );
}
