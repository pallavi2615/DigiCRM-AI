import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mail, MessageSquare, MapPin } from "lucide-react";
import { submitContact } from "@/lib/cms.functions";
import { getReferral } from "@/lib/referral";
import { buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => buildRouteMeta({
    path: "/contact",
    title: "Contact — DigiCRM AI",
    description: "Get in touch with the DigiCRM AI team. Sales, support, partnerships.",
  }),
  component: ContactPage,
});

function ContactPage() {
  const send = useServerFn(submitContact);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await send({ data: {
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        company: String(fd.get("company") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        message: String(fd.get("message") ?? ""),
        source: "contact",
        ref: getReferral() ?? undefined,
      }});
      setDone(true);
      toast.success("Message sent — we'll be in touch shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteShell>
      <section className="py-20 px-6 max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
        <div>
          <Badge variant="outline" className="mb-4">Contact</Badge>
          <h1 className="text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Talk to our team.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Questions about the product, migration, pricing or partnerships — we usually reply within one business day.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { i: Mail, l: "Email", v: "hello@digicrm.ai" },
              { i: MessageSquare, l: "Sales", v: "sales@digicrm.ai" },
              { i: MapPin, l: "HQ", v: "Remote-first · Global" },
            ].map(x => (
              <div key={x.l} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <x.i className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">{x.l}</div>
                  <div className="text-sm font-medium">{x.v}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl border bg-muted/20 p-5 text-sm">
            <div className="font-semibold mb-1.5">Prefer async?</div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Every workspace ships with an in-app support inbox. Existing customers can open a ticket from the app for the fastest response with SLA tracking.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-elegant">
          {done ? (
            <div className="text-center py-16">
              <div className="text-2xl font-bold mb-2">Thanks — message sent!</div>
              <p className="text-sm text-muted-foreground">We'll reply within one business day.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="name">Name*</Label><Input id="name" name="name" required /></div>
                <div><Label htmlFor="email">Email*</Label><Input id="email" name="email" type="email" required /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label htmlFor="company">Company</Label><Input id="company" name="company" /></div>
                <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
              </div>
              <div><Label htmlFor="message">Message</Label><Textarea id="message" name="message" rows={5} /></div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending..." : "Send message"}</Button>
            </form>
          )}
        </div>
      </section>

      <section className="py-16 px-6 border-t bg-muted/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="outline" className="mb-4">FAQ</Badge>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Common questions</h2>
          </div>
          <div className="space-y-3">
            {[
              { q: "How fast can we migrate?", a: "Most teams migrate leads, contacts and companies in under an hour using our CSV importer with field mapping. Larger data sets with attachments typically take one working day." },
              { q: "Do you support single-sign-on?", a: "Google SSO is available on every plan. SAML SSO and SCIM provisioning are included in Enterprise." },
              { q: "Where is my data hosted?", a: "Data is hosted in globally distributed Postgres with row-level security. EU-only residency is available on Enterprise." },
              { q: "Can I bring my own AI model?", a: "Yes — every AI feature runs through the Lovable AI Gateway. You can use our fast defaults or plug in your own OpenAI, Anthropic or Gemini keys." },
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
