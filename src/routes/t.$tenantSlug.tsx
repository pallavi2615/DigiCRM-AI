import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import { installBounceTracking, trackLandingEvent } from "@/lib/landing-analytics";

const getTenantWithLanding = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient<Database>(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: tenantRow } = await client
      .from("tenants_public" as never)
      .select("id, slug, name, tagline, logo_url, primary_color, accent_color, industry, plan")
      .eq("slug", data.slug)
      .maybeSingle();
    const tenant = tenantRow as { id: string; slug: string; name: string; tagline: string | null; logo_url: string | null; primary_color: string | null; accent_color: string | null; industry: string | null; plan: string } | null;
    if (!tenant) return null;
    const { data: lp } = await client
      .from("tenant_landing_pages")
      .select("hero_headline, hero_subheadline, cta_label, features, testimonial, title, seo_title, seo_description")
      .eq("tenant_id", tenant.id)
      .eq("slug", "home")
      .eq("is_published", true)
      .maybeSingle();
    return { tenant, lp };
  });

export const Route = createFileRoute("/t/$tenantSlug")({
  loader: async ({ params }) => {
    const res = await getTenantWithLanding({ data: { slug: params.tenantSlug } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.lp?.seo_title ?? loaderData?.tenant?.name ?? "Landing" },
      { name: "description", content: loaderData?.lp?.seo_description ?? loaderData?.tenant?.tagline ?? "" },
      { property: "og:title", content: loaderData?.lp?.seo_title ?? loaderData?.tenant?.name ?? "" },
      { property: "og:description", content: loaderData?.lp?.seo_description ?? loaderData?.tenant?.tagline ?? "" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenantLanding,
  errorComponent: () => <div className="p-12 text-center">Failed to load page.</div>,
  notFoundComponent: () => <div className="p-12 text-center">Landing page not found.</div>,
});

function TenantLanding() {
  const { tenant, lp } = Route.useLoaderData();
  const primary = tenant.primary_color ?? "#6366f1";
  const accent = tenant.accent_color ?? "#a855f7";

  useEffect(() => {
    void trackLandingEvent({ tenantId: tenant.id, eventType: "view" });
    return installBounceTracking(tenant.id, "home");
  }, [tenant.id]);


  return (
    <div style={{
      // scope tenant colors to hero
      ["--tenant-primary" as string]: primary,
      ["--tenant-accent" as string]: accent,
    }} className="min-h-screen bg-background">
      <header className="border-b py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-auto" />
          ) : (
            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <span className="font-bold text-lg">{tenant.name}</span>
        </div>
        <a href="#lead-form" className="text-sm px-4 py-2 rounded-md text-white"
          style={{ background: primary }}>{lp?.cta_label ?? "Get started"}</a>
      </header>

      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          background: `radial-gradient(600px circle at 30% 20%, ${primary}, transparent), radial-gradient(400px circle at 70% 60%, ${accent}, transparent)`,
        }} />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            {lp?.hero_headline ?? tenant.name}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            {lp?.hero_subheadline ?? tenant.tagline}
          </p>
          <a href="#lead-form" className="inline-block mt-8 px-8 py-3 rounded-lg text-white font-medium"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
            {lp?.cta_label ?? "Talk to us"}
          </a>
        </div>
      </section>

      {Array.isArray(lp?.features) && lp!.features.length > 0 && (
        <section className="py-16 px-6 bg-muted/20">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            {(lp!.features as Array<{ title: string; description: string }>).map((f, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white mb-3"
                    style={{ background: primary }}>
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {lp?.testimonial && (
        <section className="py-16 px-6">
          <blockquote className="max-w-3xl mx-auto text-center text-2xl italic text-muted-foreground">
            "{lp.testimonial}"
          </blockquote>
        </section>
      )}

      <section id="lead-form" className="py-20 px-6 border-t bg-muted/10">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2">Get in touch</h2>
          <p className="text-center text-muted-foreground mb-8">We'll respond within one business day.</p>
          <LeadForm tenantId={tenant.id} tenantName={tenant.name} primary={primary} />
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by <a href="/" className="text-primary hover:underline">DigiCRM AI</a>
      </footer>
    </div>
  );
}

function LeadForm({ tenantId, tenantName, primary }: { tenantId: string; tenantName: string; primary: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("leads").insert({
        tenant_id: tenantId,
        company_name: tenantName,
        contact_person: form.name,
        email: form.email,
        phone: form.phone || null,
        source: `Landing: ${tenantName}`,
        notes: form.message || null,
        status: "new",
      });
      if (error) throw error;
      setSent(true);
      window.dispatchEvent(new Event("dc:lp:submitted"));
      void trackLandingEvent({ tenantId, eventType: "submit" });
      toast.success("Thanks — we'll be in touch soon!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card><CardContent className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
        <h3 className="font-semibold text-lg">Message received!</h3>
        <p className="text-sm text-muted-foreground mt-1">We'll reach out shortly.</p>
      </CardContent></Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
      <Input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={200} />
      <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
      <Textarea placeholder="How can we help?" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} maxLength={2000} />
      <Button type="submit" disabled={loading} className="w-full text-white" style={{ background: primary }}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit
      </Button>
    </form>
  );
}
