import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildRouteMeta } from "@/lib/seo";
import {
  Sparkles, Banknote, ShieldCheck, Users, TrendingUp, Zap,
  FileCheck2, Building2, Wallet, PhoneCall, BarChart3, CheckCircle2, ArrowRight,
} from "lucide-react";
import heroImg from "@/assets/dsa-hero.jpg";
import journeyImg from "@/assets/dsa-journey.jpg";
import commissionsImg from "@/assets/dsa-commissions.jpg";

export const Route = createFileRoute("/dsa-crm")({
  head: () => buildRouteMeta({
    path: "/dsa-crm",
    title: "DSA CRM — Loan Origination & Commission Tracking | DigiCRM AI",
    description: "The colorful, all-in-one CRM built for Direct Selling Agents. Capture leads, run KYC, match lenders, disburse loans and auto-calculate commissions.",
  }),
  component: DsaCrmPage,
});

const features = [
  { icon: Banknote, title: "Loan pipeline", desc: "Kanban stages from enquiry to disbursal with lender-specific rules.", tint: "from-fuchsia-500 to-purple-600" },
  { icon: ShieldCheck, title: "KYC & docs vault", desc: "Collect PAN, Aadhaar, ITR, bank statements with audit trails.", tint: "from-orange-500 to-pink-500" },
  { icon: Building2, title: "Multi-lender network", desc: "Pre-loaded product matrix for HDFC, ICICI, Bajaj, Axis & 40+ NBFCs.", tint: "from-cyan-500 to-blue-600" },
  { icon: Wallet, title: "Commission engine", desc: "Auto-compute DSA payouts per lender, product and slab.", tint: "from-emerald-500 to-teal-600" },
  { icon: PhoneCall, title: "Tele-calling & WhatsApp", desc: "Click-to-call, WhatsApp templates and auto-follow-ups.", tint: "from-yellow-500 to-orange-500" },
  { icon: BarChart3, title: "Sourcing analytics", desc: "Track conversion by RM, branch, source and product.", tint: "from-rose-500 to-red-600" },
];

const stats = [
  { label: "Faster disbursal", value: "3.2×", tint: "text-fuchsia-500" },
  { label: "Higher approval rate", value: "+41%", tint: "text-emerald-500" },
  { label: "Lenders integrated", value: "40+", tint: "text-cyan-500" },
  { label: "Commission accuracy", value: "100%", tint: "text-orange-500" },
];

const products = [
  { name: "Personal Loan", color: "bg-fuchsia-500" },
  { name: "Home Loan", color: "bg-orange-500" },
  { name: "Business Loan", color: "bg-emerald-500" },
  { name: "LAP", color: "bg-cyan-500" },
  { name: "Auto Loan", color: "bg-rose-500" },
  { name: "Credit Card", color: "bg-yellow-500" },
];

function DsaCrmPage() {
  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden py-20 px-6 border-b">
        <div className="absolute inset-0 -z-10 opacity-70"
          style={{ background: "radial-gradient(600px circle at 15% 20%, #a855f7aa, transparent), radial-gradient(500px circle at 85% 30%, #f9731699, transparent), radial-gradient(400px circle at 50% 90%, #06b6d488, transparent)" }} />
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge className="mb-4 bg-gradient-to-r from-fuchsia-500 to-orange-500 text-white border-0">DSA CRM · Fintech Edition</Badge>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              Turn every loan enquiry into a <span className="bg-gradient-to-r from-fuchsia-500 via-orange-500 to-emerald-500 bg-clip-text text-transparent">funded disbursal.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              DigiCRM AI's DSA edition is the colorful, all-in-one workspace for Direct Selling Agents — loans, KYC, lender matching and commission payouts, without the spreadsheet chaos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white hover:opacity-90">
                <Link to="/auth">Start free trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline"><Link to="/contact">Book a demo</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {products.map(p => (
                <span key={p.name} className={`inline-flex items-center gap-2 text-xs font-medium text-white px-3 py-1 rounded-full ${p.color}`}>
                  <CheckCircle2 className="h-3 w-3" /> {p.name}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-fuchsia-500/30 via-orange-400/20 to-cyan-400/30 blur-2xl rounded-3xl" />
            <img src={heroImg} alt="DSA loan CRM dashboard" width={1600} height={1000}
              className="relative rounded-2xl shadow-2xl border border-white/10" />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 px-6 border-b bg-muted/10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-4xl md:text-5xl font-bold ${s.tint}`} style={{ fontFamily: "var(--font-display)" }}>{s.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <Badge variant="outline" className="mb-3">Everything a DSA needs</Badge>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Built for loan sourcing, from lead to payout</h2>
            <p className="mt-3 text-muted-foreground">One workspace for your team, your sub-DSAs, and your lender partners.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <Card key={f.title} className="group hover:shadow-elegant transition overflow-hidden">
                <CardContent className="p-6">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${f.tint} text-white flex items-center justify-center mb-4 shadow-lg`}>
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* JOURNEY INFOGRAPHIC */}
      <section className="py-20 px-6 bg-gradient-to-br from-fuchsia-500/5 via-orange-500/5 to-cyan-500/5 border-y">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <img src={journeyImg} alt="Loan journey funnel" width={1600} height={900} loading="lazy"
            className="rounded-2xl shadow-xl border" />
          <div>
            <Badge variant="outline" className="mb-3">The DSA journey</Badge>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>From first call to final disbursal — visualized.</h2>
            <ul className="mt-6 space-y-3">
              {[
                { icon: Users, label: "Lead capture from web, WhatsApp & referrals", c: "bg-fuchsia-500" },
                { icon: FileCheck2, label: "Instant KYC + document collection", c: "bg-orange-500" },
                { icon: Zap, label: "Eligibility & lender match in seconds", c: "bg-yellow-500" },
                { icon: Building2, label: "Application submission across 40+ lenders", c: "bg-cyan-500" },
                { icon: TrendingUp, label: "Real-time disbursal tracking", c: "bg-emerald-500" },
                { icon: Wallet, label: "Auto commission reconciliation", c: "bg-rose-500" },
              ].map(step => (
                <li key={step.label} className="flex items-start gap-3">
                  <span className={`h-8 w-8 rounded-lg text-white flex items-center justify-center ${step.c} shrink-0`}>
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm pt-1">{step.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* COMMISSIONS */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center">
          <div className="order-2 lg:order-1">
            <Badge variant="outline" className="mb-3">Commissions on autopilot</Badge>
            <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Never chase a payout again.</h2>
            <p className="mt-4 text-muted-foreground">
              Configure payout slabs per lender, product and geography. As disbursals confirm, commissions are auto-computed, split with sub-DSAs, and reconciled against lender statements.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {[
                { t: "Slab-based payouts", d: "Fixed %, tiered, or hybrid" },
                { t: "Sub-DSA splits", d: "Auto-share with your network" },
                { t: "TDS & GST ready", d: "Reports for compliance" },
                { t: "Statement reconciliation", d: "Match lender payouts in one click" },
              ].map(x => (
                <div key={x.t} className="p-4 rounded-xl border bg-card">
                  <div className="font-semibold text-sm">{x.t}</div>
                  <div className="text-xs text-muted-foreground mt-1">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-cyan-400/30 to-fuchsia-500/30 blur-2xl rounded-3xl" />
            <img src={commissionsImg} alt="Commission calculator infographic" width={1400} height={1000} loading="lazy"
              className="relative rounded-2xl shadow-xl border" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t">
        <div className="max-w-4xl mx-auto text-center relative overflow-hidden rounded-3xl p-12"
          style={{ background: "linear-gradient(135deg, #a855f7, #f97316, #06b6d4)" }}>
          <Sparkles className="h-10 w-10 text-white mx-auto" />
          <h2 className="text-4xl font-bold text-white mt-4" style={{ fontFamily: "var(--font-display)" }}>
            Ready to grow your DSA business?
          </h2>
          <p className="text-white/90 mt-3">Start free, upgrade to Prime for white-labeled landing pages & multi-branch access.</p>
          <div className="mt-6 flex justify-center gap-3 flex-wrap">
            <Button asChild size="lg" variant="secondary"><Link to="/auth">Get started free</Link></Button>
            <Button asChild size="lg" variant="outline" className="bg-white/10 text-white border-white/40 hover:bg-white/20"><Link to="/pricing">See Prime pricing</Link></Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
