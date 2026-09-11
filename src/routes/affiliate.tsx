import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, DollarSign, Users, Sparkles } from "lucide-react";
import { submitAffiliate } from "@/lib/cms.functions";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/affiliate")({
  head: () => buildRouteMeta({
    path: "/affiliate",
    title: "Affiliate Program — DigiCRM AI",
    description: "Earn recurring 30% commission on every DigiCRM AI subscription you refer. Join the affiliate partner program.",
  }),
  component: AffiliatePage,
});

function AffiliatePage() {
  const send = useServerFn(submitAffiliate);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await send({ data: {
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        company: String(fd.get("company") ?? ""),
        audience: String(fd.get("audience") ?? ""),
        channels: String(fd.get("channels") ?? ""),
        payout_method: String(fd.get("payout_method") ?? ""),
      }});
      setCode(res.referral_code);
      toast.success("Application received!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteShell>
      <section className="py-20 px-6 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto text-center">
          <Badge variant="outline" className="mb-4"><Sparkles className="h-3 w-3 mr-1.5 text-primary" /> Partner Program</Badge>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Earn 30% recurring on every referral.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Join the DigiCRM AI affiliate partner program. Get a unique referral code, share it, and earn a lifetime commission on every subscription.
          </p>
        </div>
      </section>
      <section className="py-16 px-6 max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        {[
          { i: DollarSign, t: "30% lifetime", b: "Recurring commission on every plan your referrals stay on." },
          { i: Users, t: "Any audience", b: "Sales teams, consultants, agencies, communities — everyone qualifies." },
          { i: Check, t: "Fast payouts", b: "Monthly payouts via PayPal, Wise or bank transfer over $50." },
        ].map(x => (
          <div key={x.t} className="rounded-xl border bg-card p-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <x.i className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)" }}>{x.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{x.b}</p>
          </div>
        ))}
      </section>
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border bg-card p-8 shadow-elegant">
          {code ? (
            <div className="text-center py-8">
              <div className="text-2xl font-bold mb-2">Welcome to the program!</div>
              <p className="text-sm text-muted-foreground">Your referral code:</p>
              <div className="mt-3 inline-block px-6 py-3 rounded-lg bg-primary/10 text-primary font-mono text-xl font-bold">{code}</div>
              <p className="mt-6 text-sm text-muted-foreground">We'll email onboarding details shortly.</p>
              <Button asChild className="mt-6"><Link to="/">Back home</Link></Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-display)" }}>Apply to join</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label htmlFor="name">Name*</Label><Input id="name" name="name" required /></div>
                  <div><Label htmlFor="email">Email*</Label><Input id="email" name="email" type="email" required /></div>
                </div>
                <div><Label htmlFor="company">Company / brand</Label><Input id="company" name="company" /></div>
                <div><Label htmlFor="audience">Who is your audience?</Label><Textarea id="audience" name="audience" rows={2} placeholder="Sales teams, agencies, communities..." /></div>
                <div><Label htmlFor="channels">Promotion channels</Label><Input id="channels" name="channels" placeholder="Newsletter, YouTube, LinkedIn, etc." /></div>
                <div><Label htmlFor="payout_method">Preferred payout</Label><Input id="payout_method" name="payout_method" placeholder="PayPal, Wise, Bank transfer" /></div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Submitting..." : "Apply now"}</Button>
              </form>
            </>
          )}
        </div>
      </section>

      <section className="py-16 px-6 border-t bg-muted/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">How it works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Four steps from signup to payout.</h2>
          </div>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", t: "Apply", b: "Fill the form above. Most applications approved within 48 hours." },
              { n: "02", t: "Share your code", b: "Get a unique referral link + code to share anywhere — newsletter, social, community, DMs." },
              { n: "03", t: "Earn 30%", b: "Every paid subscription attributed to your code earns you 30% for the lifetime of the customer." },
              { n: "04", t: "Get paid", b: "Payouts monthly via PayPal, Wise or bank transfer once you hit $50." },
            ].map(s => (
              <li key={s.n} className="rounded-xl border bg-card p-6">
                <div className="text-xs font-mono text-primary">{s.n}</div>
                <div className="mt-2 font-semibold" style={{ fontFamily: "var(--font-display)" }}>{s.t}</div>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 px-6 border-t">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Partner questions, answered.</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "How long does the commission last?", a: "For the entire lifetime the customer stays on a paid plan. No caps, no expiration." },
              { q: "How are referrals attributed?", a: "First-touch, 60-day cookie. Referrals also apply if the customer types your code manually at checkout." },
              { q: "Can I promote DigiCRM AI on paid ads?", a: "Yes, with two restrictions: no bidding on branded keywords, and no misleading claims. See the partner agreement in your dashboard for details." },
              { q: "Do you support co-marketing?", a: "For partners driving 10+ paid referrals we open co-marketing budgets, webinars and joint case studies." },
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
    </SiteShell>
  );
}
