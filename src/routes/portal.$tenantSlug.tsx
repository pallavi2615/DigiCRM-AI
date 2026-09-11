import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LifeBuoy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const getTenant = createServerFn({ method: "GET" })
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
    const { data: tenant } = await client
      .from("tenants_public" as never)
      .select("id, slug, name, logo_url, primary_color, accent_color")
      .eq("slug", data.slug)
      .maybeSingle();
    return tenant as { id: string; slug: string; name: string; logo_url: string | null; primary_color: string | null; accent_color: string | null } | null;
  });

export const Route = createFileRoute("/portal/$tenantSlug")({
  loader: async ({ params }) => {
    const tenant = await getTenant({ data: { slug: params.tenantSlug } });
    if (!tenant) throw notFound();
    return tenant;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Support"} — Help Center` },
      { name: "description", content: `Submit and track support requests for ${loaderData?.name ?? "us"}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Portal,
  errorComponent: () => <div className="p-12 text-center">Error loading portal.</div>,
  notFoundComponent: () => <div className="p-12 text-center">Portal not found.</div>,
});

function Portal() {
  const tenant = Route.useLoaderData();
  const primary = tenant.primary_color ?? "#6366f1";
  const [form, setForm] = useState({
    subject: "", description: "", requester_email: "", requester_name: "", priority: "normal",
  });
  const [loading, setLoading] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.from("support_tickets").insert({
        tenant_id: tenant.id,
        subject: form.subject,
        description: form.description,
        requester_email: form.requester_email,
        requester_name: form.requester_name || null,
        priority: form.priority,
        channel: "portal",
        status: "open",
      }).select("ticket_number").single();
      if (error) throw error;
      setTicketNumber(data.ticket_number);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/10">
      <header className="border-b py-4 px-6 bg-background flex items-center gap-3">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="h-8" />
        ) : (
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white" style={{ background: primary }}>
            <LifeBuoy className="h-4 w-4" />
          </div>
        )}
        <div>
          <div className="font-semibold">{tenant.name}</div>
          <div className="text-xs text-muted-foreground">Support Center</div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {ticketNumber ? (
          <Card><CardContent className="p-10 text-center">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500 mb-4" />
            <h1 className="text-2xl font-bold">Ticket #{ticketNumber} created</h1>
            <p className="text-muted-foreground mt-2">
              We've received your request. A confirmation was sent to <span className="font-medium">{form.requester_email}</span>.
            </p>
            <Button onClick={() => { setTicketNumber(null); setForm({ subject: "", description: "", requester_email: "", requester_name: "", priority: "normal" }); }} className="mt-6">
              Submit another
            </Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Submit a support request</CardTitle>
              <p className="text-sm text-muted-foreground">We usually respond within a few hours.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Your name</Label><Input required value={form.requester_name} onChange={(e) => setForm({ ...form, requester_name: e.target.value })} /></div>
                  <div><Label>Email</Label><Input required type="email" value={form.requester_email} onChange={(e) => setForm({ ...form, requester_email: e.target.value })} /></div>
                </div>
                <div><Label>Subject</Label><Input required maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Describe your issue</Label><Textarea rows={6} required maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <Button type="submit" disabled={loading} className="w-full text-white" style={{ background: primary }}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit ticket
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
