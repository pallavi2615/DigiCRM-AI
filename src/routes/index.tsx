import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteShell } from "@/components/site-shell";
import {
  Sparkles, Users, KanbanSquare, BarChart3, Zap, ShieldCheck, Bot, ScrollText,
  ArrowRight, Check, LayoutDashboard, Building2, CheckSquare, FileText, Search,
  UploadCloud, Landmark, Home, Laptop, Package, TrendingUp, Target, Rocket, Clock,
} from "lucide-react";
import { listHomeSlides, listPublishedPosts } from "@/lib/cms.functions";
import { buildRouteMeta } from "@/lib/seo";
import infoFunnel from "@/assets/infographic-funnel.jpg";
import infoWorkflow from "@/assets/infographic-workflow.jpg";
import infoStack from "@/assets/infographic-stack.jpg";

export const Route = createFileRoute("/")({
  head: () => buildRouteMeta({
    path: "/",
    title: "DigiCRM AI — The AI-native CRM for modern sales teams",
    description: "Multi-tenant AI-powered sales CRM. Pipelines, proposals, automation, and audit-grade governance — in one workspace.",
    jsonLd: [{
      "@context": "https://schema.org", "@type": "SoftwareApplication",
      name: "DigiCRM AI", applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    }],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);
  const fetchSlides = useServerFn(listHomeSlides);
  const fetchPosts = useServerFn(listPublishedPosts);
  const { data: slides = [] } = useQuery({ queryKey: ["cms-home-slides"], queryFn: () => fetchSlides() });
  const { data: posts = [] } = useQuery({ queryKey: ["blog-posts"], queryFn: () => fetchPosts() });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  const active = slides[idx];

  return (
    <SiteShell>
      <div className="relative overflow-x-hidden">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-30 blur-3xl"
               style={{ background: "radial-gradient(circle at center, var(--primary-glow), transparent 60%)" }} />
          <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
               style={{ background: "radial-gradient(circle, var(--info), transparent 60%)" }} />
        </div>

        {/* HERO with rotating slides */}
        <section className="relative pt-20 pb-24 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 py-1.5 px-4 gap-2 border-primary/30 bg-primary/5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-xs">Now shipping — AI proposal writer & workflow automation</span>
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>
              {active ? (
                <span key={active.id} className="inline-block animate-in fade-in slide-in-from-bottom-2 duration-700">
                  {active.headline.split(" ").map((w, i, arr) =>
                    i === Math.floor(arr.length / 2) ? (
                      <span key={i} className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>{w} </span>
                    ) : <span key={i}>{w} </span>
                  )}
                </span>
              ) : (
                <>The CRM that <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>thinks</span> with your team.</>
              )}
            </h1>

            <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {active?.subhead ?? "DigiCRM AI unifies pipelines, contacts, AI-authored proposals, automation and audit-grade governance."}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-8 text-base shadow-elegant">
                <Link to={signedIn ? "/dashboard" : (active?.cta_url ?? "/auth")}>
                  {signedIn ? "Open dashboard" : (active?.cta_label ?? "Start 14-day trial")} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
                <Link to="/features">See features</Link>
              </Button>
            </div>

            {slides.length > 1 && (
              <div className="mt-8 flex justify-center gap-1.5">
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
                    aria-label={`Slide ${i + 1}`} />
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> SOC-2 ready</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Migrate in 1 day</span>
            </div>
          </div>

          {/* Product mock */}
          <div className="mt-20 max-w-6xl mx-auto">
            <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
                 style={{ boxShadow: "0 40px 80px -20px color-mix(in oklab, var(--primary) 25%, transparent)" }}>
              <div className="flex items-center gap-1.5 px-4 py-3 border-b bg-muted/40">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <div className="ml-4 text-xs text-muted-foreground">app.digicrm.ai/dashboard</div>
              </div>
              <div className="grid grid-cols-12 min-h-[420px]">
                <div className="hidden md:block col-span-2 border-r bg-sidebar p-3 space-y-1">
                  {[
                    { i: LayoutDashboard, l: "Dashboard", a: true },
                    { i: Users, l: "Leads" }, { i: Building2, l: "Companies" },
                    { i: KanbanSquare, l: "Pipeline" }, { i: CheckSquare, l: "Tasks" },
                    { i: Bot, l: "AI Assistant" }, { i: FileText, l: "Proposals" },
                    { i: BarChart3, l: "Reports" }, { i: ScrollText, l: "Audit Logs" },
                  ].map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${r.a ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
                      <r.i className="h-3.5 w-3.5" /> {r.l}
                    </div>
                  ))}
                </div>
                <div className="col-span-12 md:col-span-10 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold">Good morning, Marcus</div>
                      <div className="text-xs text-muted-foreground">Here's your revenue snapshot</div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                      <Search className="h-3.5 w-3.5" /> <kbd className="px-1.5 py-0.5 rounded border text-[10px]">⌘K</kbd>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { l: "Pipeline", v: "$1.28M", d: "+18%", c: "text-success" },
                      { l: "Won this month", v: "$342K", d: "+9%", c: "text-success" },
                      { l: "Active leads", v: "218", d: "+34", c: "text-info" },
                      { l: "Win rate", v: "38%", d: "+4pts", c: "text-primary" },
                    ].map(k => (
                      <div key={k.l} className="rounded-lg border p-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</div>
                        <div className="text-lg font-bold mt-1">{k.v}</div>
                        <div className={`text-[10px] ${k.c} mt-0.5`}>{k.d}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border p-4 h-40 relative overflow-hidden">
                    <div className="text-xs font-medium mb-2">Revenue trend</div>
                    <svg viewBox="0 0 300 100" className="w-full h-24">
                      <defs>
                        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0 80 L30 70 L60 75 L90 55 L120 60 L150 40 L180 45 L210 30 L240 25 L270 15 L300 20 L300 100 L0 100 Z" fill="url(#grad)" />
                      <path d="M0 80 L30 70 L60 75 L90 55 L120 60 L150 40 L180 45 L210 30 L240 25 L270 15 L300 20" stroke="var(--primary)" strokeWidth="2" fill="none" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INFOGRAPHIC — "How DigiCRM AI works" */}
        <section className="py-24 px-6 border-y border-border/40 bg-muted/20">
          <div className="max-w-6xl mx-auto text-center mb-14">
            <Badge variant="outline" className="mb-4">The DigiCRM AI flywheel</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Capture. Qualify. Close. Repeat — with AI at every step.
            </h2>
          </div>
          <div className="max-w-5xl mx-auto grid md:grid-cols-4 gap-4 relative">
            <svg className="hidden md:block absolute top-8 left-[12%] right-[12%] h-4 -z-0" viewBox="0 0 800 20" preserveAspectRatio="none">
              <path d="M0 10 L800 10" stroke="var(--primary)" strokeWidth="2" strokeDasharray="4 6" opacity="0.4" />
            </svg>
            {[
              { i: Target, n: "01", t: "Capture", b: "Import CSVs, capture leads from forms, sync from webhooks." },
              { i: Bot, n: "02", t: "Qualify", b: "AI scores intent, drafts outreach, and highlights next-best action." },
              { i: Rocket, n: "03", t: "Close", b: "Proposals in seconds, automated follow-ups, pipeline forecasting." },
              { i: TrendingUp, n: "04", t: "Retain", b: "Realtime reports, audit-grade governance, and role-based access." },
            ].map((s) => (
              <div key={s.n} className="relative rounded-2xl border bg-card p-6 text-center hover:shadow-elegant transition-all">
                <div className="mx-auto h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground shadow-elegant mb-3">
                  <s.i className="h-6 w-6" />
                </div>
                <div className="text-xs font-mono text-primary">{s.n}</div>
                <div className="font-semibold mt-1" style={{ fontFamily: "var(--font-display)" }}>{s.t}</div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { v: "9", l: "core modules" }, { v: "4", l: "industry CRMs" },
              { v: "38%", l: "avg. win rate lift" }, { v: "<1s", l: "AI response" },
            ].map((k) => (
              <div key={k.l} className="rounded-xl border bg-card p-6 text-center">
                <div className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>{k.v}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{k.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Colorful infographics gallery */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">Visual overview</Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                See the whole revenue engine at a glance.
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { src: infoFunnel, alt: "AI-powered sales funnel infographic", title: "The AI funnel" },
                { src: infoWorkflow, alt: "DigiCRM automation workflow infographic", title: "Automations" },
                { src: infoStack, alt: "DigiCRM full CRM stack infographic", title: "Full stack" },
              ].map((g) => (
                <figure key={g.title} className="group rounded-2xl overflow-hidden border bg-card shadow-card hover:shadow-elegant transition-all">
                  <img src={g.src} alt={g.alt} loading="lazy" className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform" />
                  <figcaption className="p-4 text-sm font-medium" style={{ fontFamily: "var(--font-display)" }}>{g.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Industries strip */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto text-center mb-10">
            <Badge variant="outline" className="mb-4">Industry-tuned</Badge>
            <h2 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Prebuilt for your industry.
            </h2>
          </div>
          <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { i: Landmark, t: "Fintech DSA", to: "/fintech", desc: "Loan pipeline · KYC · payouts" },
              { i: Home, t: "Real Estate", to: "/realestate", desc: "Clients · properties · deals" },
              { i: Laptop, t: "IT Company", to: "/it", desc: "Projects · tickets · pipeline" },
              { i: Package, t: "Product Sales", to: "/productsales", desc: "Catalog · orders · commissions" },
            ].map((x) => (
              <Link key={x.t} to={x.to} className="group rounded-xl border bg-card p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
                <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground mb-4">
                  <x.i className="h-5 w-5" />
                </div>
                <div className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{x.t}</div>
                <div className="text-xs text-muted-foreground mt-1">{x.desc}</div>
                <div className="mt-3 text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">Explore <ArrowRight className="h-3 w-3" /></div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button asChild variant="outline"><Link to="/industries">See all industries</Link></Button>
          </div>
        </section>

        {/* Feature grid */}
        <section className="py-24 px-6 border-t border-border/40">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <Badge variant="outline" className="mb-4">Everything in one workspace</Badge>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                One CRM. Nine superpowers.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: KanbanSquare, title: "Visual pipeline", body: "Drag-and-drop Kanban with realtime updates. Forecast revenue as deals move." },
                { icon: Bot, title: "AI Assistant", body: "Ask the CRM anything. Draft emails, proposals and summaries grounded in your data." },
                { icon: Zap, title: "Automation", body: "Trigger tasks, notifications and follow-ups when stages, priorities or owners change." },
                { icon: UploadCloud, title: "Bulk CSV import/export", body: "Migrate leads, contacts and companies in minutes with templated field mapping." },
                { icon: Search, title: "Global ⌘K search", body: "Jump to any lead, contact, company or task from anywhere with one keystroke." },
                { icon: ScrollText, title: "Audit logs", body: "Every change captured. Diffs, actors and timestamps — audit-grade governance." },
                { icon: BarChart3, title: "Reports & analytics", body: "KPIs, trends, sources, and priorities that stay in sync with your pipeline." },
                { icon: ShieldCheck, title: "RBAC & row-level security", body: "Four roles, RLS-enforced policies, and secure server-side authorization." },
                { icon: FileText, title: "AI proposals", body: "Turn a paragraph of intent into a client-ready proposal with export in one click." },
              ].map(f => (
                <div key={f.title} className="group rounded-xl border border-border/60 bg-card p-6 hover:border-primary/40 hover:shadow-elegant transition-all">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1.5" style={{ fontFamily: "var(--font-display)" }}>{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Button asChild variant="outline"><Link to="/features">See all features</Link></Button>
            </div>
          </div>
        </section>

        {/* Blog teaser */}
        {posts.length > 0 && (
          <section className="py-20 px-6 border-t border-border/40 bg-muted/20">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-end justify-between mb-8 flex-wrap gap-2">
                <div>
                  <Badge variant="outline" className="mb-3">From the blog</Badge>
                  <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Latest insights</h2>
                </div>
                <Button asChild variant="ghost" size="sm"><Link to="/blog">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.slice(0, 3).map((p) => (
                  <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }}
                    className="group rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-elegant transition-all">
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {p.tags.slice(0, 2).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                    </div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-display)" }}>{p.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                    <div className="mt-4 text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {p.reading_minutes} min read
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center rounded-3xl border bg-card p-12 shadow-elegant relative overflow-hidden">
            <div className="absolute inset-0 -z-10 opacity-30" style={{ background: "radial-gradient(circle at 50% 0%, var(--primary-glow), transparent 60%)" }} />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Ready to sell smarter?
            </h2>
            <p className="mt-4 text-muted-foreground">Start your 14-day free trial. No credit card required.</p>
            <div className="mt-8 flex justify-center gap-3">
              <Button asChild size="lg"><Link to={signedIn ? "/dashboard" : "/auth"}>{signedIn ? "Open dashboard" : "Get started"} <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/contact">Talk to sales</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}



// src/api/index.ts
// import axios from 'axios';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// const api = axios.create({
//   baseURL: API_URL,
//   headers: { 'Content-Type': 'application/json' },
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('access_token');
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem('access_token');
//       localStorage.removeItem('refresh_token');
//       localStorage.removeItem('user');
//       if (window.location.pathname !== '/auth') {
//         window.location.href = '/auth';
//       }
//     }
//     return Promise.reject(error);
//   }
// );

// export const authAPI = {
//   signUp: (data: { full_name: string; email: string; password: string; role?: string }) =>
//     api.post('/auth/signup', data),
//   signIn: (data: { email: string; password: string }) =>
//     api.post('/auth/signin', data),
//   forgotPassword: (email: string) =>
//     api.post('/auth/forgot-password', { email }),
//   resetPassword: (token: string, new_password: string) =>
//     api.post('/auth/reset-password', { token, new_password }),
//   getMe: () => api.get('/auth/me'),
//   logout: () => api.post('/auth/logout'),
//   changePassword: (old_password: string, new_password: string) =>
//     api.post('/auth/change-password', { old_password, new_password }),
// };

// export default api;