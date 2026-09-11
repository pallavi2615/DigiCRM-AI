import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePack } from "@/lib/pack-config";
import { VERIFICATION_LABELS } from "@/lib/industry-packs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckCircle2, Loader2, LogIn } from "lucide-react";

export const Route = createFileRoute("/portal/apply/$group/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `Apply — ${name} | DigiPortal` },
        { name: "description", content: `Submit your ${name.toLowerCase()} application, track its status and upload documents in the DigiCRM client portal.` },
        { property: "og:title", content: `Apply — ${name} | DigiPortal` },
        { property: "og:description", content: `Start a ${name.toLowerCase()} application and follow every stage online.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ApplyPage,
});

function ApplyPage() {
  const { group, slug } = Route.useParams();
  const { pack, isLoading } = usePack(group, slug);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: "", phone: "", city: "", value: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const { data: mine = [] } = useQuery({
    queryKey: ["portal-apply-mine", group, slug, user?.email],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_records")
        .select("id, title, stage, created_at")
        .eq("group_slug", group)
        .eq("pack_slug", slug)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!pack || !user) return;
    setSubmitting(true);
    try {
      const title = `${contact.name || user.email} — ${pack.recordLabel}`;
      const { data, error } = await supabase
        .from("pack_records")
        .insert({
          group_slug: pack.group,
          pack_slug: pack.slug,
          title,
          stage: pack.stages[0]!,
          value: contact.value ? Number(contact.value) : null,
          contact_name: contact.name || null,
          contact_email: user.email ?? null,
          contact_phone: contact.phone || null,
          city: contact.city || null,
          notes: contact.notes || null,
          source: "Client portal",
          fields: form,
          owner_id: user.id,
          created_by: user.id,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      setDone((data as { id: string }).id);
      toast.success("Application submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the application");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
    );
  }

  if (!pack) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-2xl p-12 text-center">
          <h1 className="text-2xl font-bold">Pack not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This application form is no longer available.</p>
          <Button asChild className="mt-4"><Link to="/industries">Browse industries</Link></Button>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        <header className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{pack.groupName} · DigiPortal</div>
          <h1 className="text-3xl font-bold">{pack.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{pack.tagline}</p>
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant="secondary" className="text-[10px]">{pack.stages.length} stages</Badge>
            {pack.verifications.map((v) => (
              <Badge key={v} variant="outline" className="text-[10px]">{VERIFICATION_LABELS[v]}</Badge>
            ))}
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How it works</CardTitle>
            <CardDescription>Your application moves through these stages — you can follow it in the portal at any time.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {pack.stages.map((s, i) => (
              <Badge key={s} variant={i === 0 ? "default" : "outline"} className="text-[11px]">{i + 1}. {s}</Badge>
            ))}
          </CardContent>
        </Card>

        {done ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h2 className="text-lg font-semibold">Application received</h2>
              <p className="text-sm text-muted-foreground">
                Your {pack.recordLabel.toLowerCase()} is now at “{pack.stages[0]}”. Track status and upload documents from your portal.
              </p>
              <Button onClick={() => navigate({ to: "/portal" })}>Go to my portal</Button>
            </CardContent>
          </Card>
        ) : !user ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <LogIn className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Sign in to apply</h2>
              <p className="text-sm text-muted-foreground">Create a free account or sign in — your applications, documents and payments stay private to you.</p>
              <Button asChild><Link to="/auth">Sign in or sign up</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your {pack.recordLabel.toLowerCase()}</CardTitle>
              <CardDescription>Submitting as {user.email}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{pack.partyLabel} name</Label>
                <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{pack.valueLabel} (₹)</Label>
                <Input type="number" value={contact.value} onChange={(e) => setContact({ ...contact, value: e.target.value })} />
              </div>

              {pack.fields.map((f) => (
                <div key={f.key} className={`space-y-1.5 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                  <Label>{f.label}</Label>
                  {f.type === "select" ? (
                    <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : f.type === "textarea" ? (
                    <Textarea rows={3} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Anything else we should know?</Label>
                <Textarea rows={3} value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />
              </div>

              <div className="sm:col-span-2">
                <Button onClick={submit} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit application
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {user && mine.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Your existing applications in this pack</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {mine.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                  <span>{r.title}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.stage}</Badge>
                </div>
              ))}
              <Button asChild variant="link" size="sm" className="px-0"><Link to="/portal">Open my portal</Link></Button>
            </CardContent>
          </Card>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
