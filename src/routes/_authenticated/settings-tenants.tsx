import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, ExternalLink, Copy, Loader2, ShieldAlert, Crown, Globe, Webhook, Palette } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";
import { Link } from "@tanstack/react-router";
import { useTenantWebhookSecret } from "@/lib/tenants";

function TenantWebhookSecretReveal({ tenantId }: { tenantId: string }) {
  const { data: secret, isLoading } = useTenantWebhookSecret(tenantId);
  if (isLoading) return <div className="text-[11px] text-muted-foreground">Loading…</div>;
  if (!secret) return (
    <div className="text-[11px] text-muted-foreground italic">
      Hidden — only Super Admin / Admin can view this secret.
    </div>
  );
  return (
    <div className="flex gap-2 items-center">
      <code className="text-[11px] bg-background rounded p-2 flex-1 truncate">{secret}</code>
      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(secret); toast.success("Copied"); }}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/settings-tenants")({
  head: () => ({ meta: [{ title: "Tenants — DigiCRM AI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <RoleGuard allow={ADMINS} module="settings-tenants" label="Settings Tenants">
      <SettingsTenants />
    </RoleGuard>
  ),
});

type Tenant = {
  id: string;
  slug: string;
  name: string;
  plan: "lite" | "prime";
  tagline: string | null;
  primary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  industry: string | null;
  custom_domain: string | null;
  is_active: boolean;
};

function SettingsTenants() {
  const { roles, isAdmin } = useAuth();
  const canManage = isAdmin || roles.includes("super_admin");
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, name, plan, tagline, primary_color, accent_color, logo_url, industry, custom_domain, is_active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
  });

  if (!canManage) {
    return (
      <Card><CardContent className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h2 className="font-semibold">Admin access required</h2>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Building2 className="h-6 w-6" /> Tenants & White-Labeling</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-tenant workspaces, plans and branded portals.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" /> New Tenant</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Public URLs</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">/t/{t.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.plan === "prime" ? "default" : "outline"}>
                        {t.plan === "prime" && <Crown className="h-3 w-3 mr-1 text-amber-300" />}
                        {t.plan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.industry ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <Link to="/t/$tenantSlug" params={{ tenantSlug: t.slug }} className="text-primary hover:underline flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Landing page
                        </Link>
                        <Link to="/portal/$tenantSlug" params={{ tenantSlug: t.slug }} className="text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Support portal
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setEditing(t)}>Manage</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && <TenantForm onClose={() => setCreating(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["tenants-admin"] })} />}
      {editing && <TenantForm tenant={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["tenants-admin"] })} />}
    </div>
  );
}

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function TenantForm({ tenant, onClose, onSaved }: { tenant?: Tenant; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!tenant;
  const [form, setForm] = useState<Partial<Tenant>>({
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    plan: tenant?.plan ?? "lite",
    tagline: tenant?.tagline ?? "",
    industry: tenant?.industry ?? "",
    custom_domain: tenant?.custom_domain ?? "",
    primary_color: tenant?.primary_color ?? "#6366f1",
    accent_color: tenant?.accent_color ?? "#a855f7",
    logo_url: tenant?.logo_url ?? "",
    is_active: tenant?.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit && tenant) {
        const { error } = await supabase.from("tenants").update(form).eq("id", tenant.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
          name: form.name!,
          slug: form.slug || slugify(form.name!),
          plan: form.plan ?? "lite",
          tagline: form.tagline ?? null,
          industry: form.industry ?? null,
          custom_domain: form.custom_domain ?? null,
          primary_color: form.primary_color ?? null,
          accent_color: form.accent_color ?? null,
          logo_url: form.logo_url ?? null,
          is_active: form.is_active ?? true,
          owner_id: user?.id ?? null,
        };
        const { error } = await supabase.from("tenants").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "Tenant updated" : "Tenant created"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateLP = async (industrySlug: string) => {
    if (!tenant) return;
    const tmpl = INDUSTRY_TEMPLATES.find((t) => t.slug === industrySlug);
    if (!tmpl) return;
    const { error } = await supabase.from("tenant_landing_pages").upsert({
      tenant_id: tenant.id,
      slug: "home",
      industry: industrySlug,
      title: tmpl.title,
      hero_headline: tmpl.hero_headline,
      hero_subheadline: tmpl.hero_subheadline,
      cta_label: tmpl.cta_label,
      features: tmpl.features,
      testimonial: tmpl.testimonial,
      is_published: true,
      seo_title: `${tenant.name} — ${tmpl.title}`,
      seo_description: tmpl.hero_subheadline,
    }, { onConflict: "tenant_id,slug" });
    if (error) toast.error(error.message);
    else toast.success(`Landing page generated from "${tmpl.industry}" template`);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? `Manage ${tenant?.name}` : "New Tenant"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value, slug: isEdit ? form.slug : slugify(e.target.value) })} />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plan</Label>
              <Select value={form.plan ?? "lite"} onValueChange={(v: "lite" | "prime") => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lite">Lite</SelectItem>
                  <SelectItem value="prime">Prime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Industry template</Label>
              <Select value={form.industry ?? ""} onValueChange={(v) => setForm({ ...form, industry: v })}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRY_TEMPLATES.map((t) => <SelectItem key={t.slug} value={t.slug}>{t.industry}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Tagline</Label>
            <Textarea rows={2} value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="flex items-center gap-1"><Palette className="h-3 w-3" /> Primary</Label>
              <Input type="color" value={form.primary_color ?? "#6366f1"} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
            </div>
            <div>
              <Label>Accent</Label>
              <Input type="color" value={form.accent_color ?? "#a855f7"} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={form.logo_url ?? ""} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
            </div>
          </div>
          <div>
            <Label>Custom domain (optional)</Label>
            <Input value={form.custom_domain ?? ""} onChange={(e) => setForm({ ...form, custom_domain: e.target.value })} placeholder="crm.example.com" />
          </div>

          {isEdit && tenant && (
            <>
              <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1"><Webhook className="h-3 w-3" /> Inbound Lead Webhook</div>
                <div className="text-xs">POST leads to:</div>
                <code className="block text-[11px] bg-background rounded p-2 break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/public/inbound/leads/{tenant.slug}
                </code>
                <div className="text-xs">Header <code className="bg-background px-1 rounded">x-webhook-secret</code> (admin-only):</div>
                <TenantWebhookSecretReveal tenantId={tenant.id} />
              </div>


              <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground">Generate landing page</div>
                <p className="text-xs text-muted-foreground">Create a public industry-specific landing page with an embedded lead form.</p>
                <div className="flex gap-2 flex-wrap">
                  {INDUSTRY_TEMPLATES.map((t) => (
                    <Button key={t.slug} size="sm" variant="outline" onClick={() => generateLP(t.slug)}>{t.industry}</Button>
                  ))}
                </div>
                <Link to="/t/$tenantSlug" params={{ tenantSlug: tenant.slug }} className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1">
                  <ExternalLink className="h-3 w-3" /> View landing page
                </Link>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
