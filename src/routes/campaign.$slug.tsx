import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Sparkles, Star, Zap, Shield, Rocket, Quote } from "lucide-react";
import { getCampaignBySlug, submitContact } from "@/lib/cms.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/campaign/$slug")({
  loader: async ({ params }) => {
    const campaign = await getCampaignBySlug({ data: { slug: params.slug } });
    if (!campaign) throw notFound();
    return { campaign };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.campaign;
    const path = `/campaign/${params.slug}`;
    if (!c) return buildRouteMeta({ path, title: "Campaign not found — DigiCRM AI", description: "This campaign isn't available.", noindex: true });
    return buildRouteMeta({
      path,
      title: `${c.headline} — DigiCRM AI`,
      description: c.subhead ?? c.headline,
      ogImage: c.hero_image ?? undefined,
    });
  },
  component: CampaignLP,
  notFoundComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold">Campaign not found</h1>
        <Button asChild className="mt-6"><Link to="/">Home</Link></Button>
      </div>
    </SiteShell>
  ),
});

function CampaignLP() {
  const { campaign } = Route.useLoaderData();
  const send = useServerFn(submitContact);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(k => {
        const v = urlParams.get(k);
        if (v) utm[k] = v;
      });
      await send({ data: {
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        company: String(fd.get("company") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        message: `Campaign: ${campaign.slug}`,
        source: `campaign:${campaign.slug}`,
        utm,
      }});
      setDone(true);
      toast.success("Thanks!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const fields = campaign.form_fields ?? ["name","email","company","phone"];
  const benefits = campaign.benefits ?? [
    "AI-scored leads delivered daily",
    "Automated follow-ups across channels",
    "Real-time pipeline visibility",
    "Enterprise-grade audit logs",
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Animated gradient backdrop */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl animate-pulse"
             style={{ background: "radial-gradient(circle, #8b5cf6, transparent 60%)" }} />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl animate-pulse"
             style={{ background: "radial-gradient(circle, #ec4899, transparent 60%)", animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-20 blur-3xl"
             style={{ background: "radial-gradient(circle, #f59e0b, transparent 60%)" }} />
      </div>

      {/* Sticky mini-nav */}
      <div className="sticky top-0 z-30 backdrop-blur-lg bg-background/70 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>DigiCRM AI</span>
          </Link>
          <a href="#claim" className="text-sm font-medium text-primary hover:underline">Claim offer →</a>
        </div>
      </div>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-start">
        <div>
          <Badge className="mb-4 py-1.5 px-3 border-0 text-white shadow-lg" style={{ background: "linear-gradient(135deg,#ec4899,#8b5cf6)" }}>
            <Sparkles className="h-3 w-3 mr-1.5" /> Limited-time offer
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]" style={{ fontFamily: "var(--font-display)" }}>
            {campaign.headline?.split(" ").map((w: string, i: number, arr: string[]) =>
              i === Math.floor(arr.length / 2) ? (
                <span key={i} className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg,#8b5cf6,#ec4899,#f59e0b)" }}>{w} </span>
              ) : <span key={i}>{w} </span>
            )}
          </h1>
          {campaign.subhead && <p className="mt-6 text-xl text-muted-foreground">{campaign.subhead}</p>}

          <ul className="mt-8 space-y-3">
            {benefits.map((b: string) => (
              <li key={b} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#10b981,#06b6d4)" }}>
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-base">{b}</span>
              </li>
            ))}
          </ul>

          {/* Trust strip */}
          <div className="mt-10 flex flex-wrap gap-6 items-center text-sm">
            <div className="flex items-center gap-1.5">
              <div className="flex">{[...Array(5)].map((_,i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>
              <span className="text-muted-foreground">4.9 · G2</span>
            </div>
            <div className="text-muted-foreground">SOC-2 · GDPR · SSO</div>
          </div>
        </div>

        {/* FORM CARD */}
        <div id="claim" className="rounded-3xl border-2 border-primary/20 bg-card p-8 shadow-2xl relative">
          <div className="absolute -top-3 left-6 rounded-full text-xs font-bold text-white px-3 py-1 shadow-md" style={{ background: "linear-gradient(135deg,#ec4899,#f59e0b)" }}>
            🎁 Free trial · No card required
          </div>
          {done ? (
            <div className="text-center py-16">
              <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center text-white mb-4" style={{ background: "linear-gradient(135deg,#10b981,#06b6d4)" }}>
                <Check className="h-8 w-8" />
              </div>
              <div className="text-2xl font-bold mb-2">You're in!</div>
              <p className="text-sm text-muted-foreground">{campaign.thank_you_message ?? "We'll be in touch within 24 hours."}</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>Claim your offer</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                {fields.includes("name") && <div><Label htmlFor="name">Full name*</Label><Input id="name" name="name" required className="mt-1.5" /></div>}
                {fields.includes("email") && <div><Label htmlFor="email">Work email*</Label><Input id="email" name="email" type="email" required className="mt-1.5" /></div>}
                {fields.includes("company") && <div><Label htmlFor="company">Company</Label><Input id="company" name="company" className="mt-1.5" /></div>}
                {fields.includes("phone") && <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" className="mt-1.5" /></div>}
                <Button type="submit" className="w-full h-12 text-base font-semibold shadow-xl border-0 text-white" style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }} disabled={loading}>
                  {loading ? "Submitting..." : (campaign.cta_label ?? "Get started free")}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">By submitting you agree to our terms & privacy policy.</p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* BENEFIT TILES */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12" style={{ fontFamily: "var(--font-display)" }}>
          Why teams switch to <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>DigiCRM AI</span>
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Zap, title: "3× faster close", desc: "AI-authored follow-ups & proposals cut cycle time.", bg: "linear-gradient(135deg,#f59e0b,#ec4899)" },
            { icon: Shield, title: "Audit-grade governance", desc: "SOC-2 controls & role-based access on every action.", bg: "linear-gradient(135deg,#06b6d4,#6366f1)" },
            { icon: Rocket, title: "Live in a day", desc: "Templates for 10+ industries. Bring your CSVs — we do the rest.", bg: "linear-gradient(135deg,#10b981,#06b6d4)" },
          ].map((t) => (
            <div key={t.title} className="rounded-2xl border bg-card p-6 hover:shadow-xl transition-shadow">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-lg mb-4" style={{ background: t.bg }}>
                <t.icon className="h-6 w-6" />
              </div>
              <div className="font-bold text-lg">{t.title}</div>
              <div className="text-sm text-muted-foreground mt-2">{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIAL STRIP */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6 50%,#ec4899)" }}>
          <Quote className="absolute top-4 right-6 h-24 w-24 opacity-20" />
          <div className="relative">
            <div className="flex mb-4">{[...Array(5)].map((_,i) => <Star key={i} className="h-5 w-5 fill-amber-300 text-amber-300" />)}</div>
            <p className="text-xl leading-relaxed">
              "Our sales team went from spreadsheets to real-time forecasts in two days. The AI proposal writer alone saves us 10 hours a week."
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center font-bold">MP</div>
              <div>
                <div className="font-semibold">Marcus Peters</div>
                <div className="text-sm opacity-80">VP Sales · Northline SaaS</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STICKY CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Ready to close faster?</h2>
        <p className="text-muted-foreground mt-3">Join hundreds of teams shipping revenue with DigiCRM AI.</p>
        <Button asChild size="lg" className="mt-8 h-12 px-8 shadow-2xl border-0 text-white" style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}>
          <a href="#claim">Claim your offer <Rocket className="ml-2 h-4 w-4" /></a>
        </Button>
      </section>
    </div>
  );
}
