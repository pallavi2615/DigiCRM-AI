import { RoleGuard, SUPER_ONLY } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ShieldAlert, Eye, Pencil, ExternalLink } from "lucide-react";
import { ImageUploadField } from "@/components/cms/ImageUploadField";
import { PagesAdmin } from "@/components/cms/PagesAdmin";

export const Route = createFileRoute("/_authenticated/settings-cms")({
  head: () => ({ meta: [{ title: "Content Management — DigiCRM AI" }] }),
  component: () => (
    <RoleGuard allow={SUPER_ONLY} module="settings-cms" label="CMS">
      <CmsAdmin />
    </RoleGuard>
  ),
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
function readingMinutes(body: string) {
  const words = (body || "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function CmsAdmin() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setRole(data?.role ?? null);
    })();
  }, []);

  if (role === null) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (role !== "super_admin") {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-warning mx-auto mb-3" />
        <h1 className="text-xl font-bold">Access denied</h1>
        <p className="text-sm text-muted-foreground mt-2">Only Super Admins can manage site content.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Content Management</h1>
        <p className="text-sm text-muted-foreground">Manage marketing pages, blog, hero slides, menus, campaigns and SEO.</p>
      </div>
      <Tabs defaultValue="pages">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="posts">Blog</TabsTrigger>
          <TabsTrigger value="slides">Hero</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="pages"><PagesAdmin /></TabsContent>
        <TabsContent value="posts"><PostsAdmin /></TabsContent>
        <TabsContent value="slides"><SlidesAdmin /></TabsContent>
        <TabsContent value="menu"><MenuAdmin /></TabsContent>
        <TabsContent value="campaigns"><CampaignsAdmin /></TabsContent>
        <TabsContent value="seo"><SeoAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Blog ---------------- */

interface Post {
  id?: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  cover_image?: string | null;
  og_image?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  tags?: string[];
  status: "draft" | "published";
  published_at?: string | null;
  reading_minutes?: number;
}

function PostsAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Post | null>(null);
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("cms_posts").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Post[];
    },
  });

  function newPost() {
    setEditing({ slug: "", title: "", body: "", excerpt: "", tags: [], status: "draft" });
  }

  async function togglePublish(p: Post) {
    const next = p.status === "published" ? "draft" : "published";
    const patch: any = { status: next };
    if (next === "published" && !p.published_at) patch.published_at = new Date().toISOString();
    const { error } = await (supabase as any).from("cms_posts").update(patch).eq("id", p.id!);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  }

  async function del(id: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    const { error } = await (supabase as any).from("cms_posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-posts"] });
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Blog posts</h2>
          <p className="text-xs text-muted-foreground">Create, edit, publish or unpublish articles. Slugs power /blog/&lt;slug&gt; URLs and SEO.</p>
        </div>
        <Button size="sm" onClick={newPost}><Plus className="h-4 w-4 mr-1" /> New post</Button>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No posts yet — create your first article.</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {posts.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3">
              {p.cover_image
                ? <img src={p.cover_image} alt="" className="w-14 h-14 rounded object-cover bg-muted" />
                : <div className="w-14 h-14 rounded bg-muted" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.title || "(untitled)"}</span>
                  <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">/blog/{p.slug || "…"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => togglePublish(p)}>
                {p.status === "published" ? "Unpublish" : "Publish"}
              </Button>
              {p.status === "published" && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(p.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PostEditor
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-posts"] }); }}
        />
      )}
    </Card>
  );
}

function PostEditor({ post, onClose, onSaved }: { post: Post; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<Post>(post);
  const [saving, setSaving] = useState(false);
  const isNew = !p.id;

  function patch<K extends keyof Post>(k: K, v: Post[K]) { setP(prev => ({ ...prev, [k]: v })); }

  async function save(status?: Post["status"]) {
    const finalSlug = (p.slug || slugify(p.title)).trim();
    if (!finalSlug || !p.title.trim()) { toast.error("Title and slug are required"); return; }
    const payload: any = {
      ...p,
      slug: finalSlug,
      reading_minutes: readingMinutes(p.body),
    };
    if (status) {
      payload.status = status;
      if (status === "published" && !p.published_at) payload.published_at = new Date().toISOString();
    }
    setSaving(true);
    const { error } = isNew
      ? await (supabase as any).from("cms_posts").insert(payload)
      : await (supabase as any).from("cms_posts").update(payload).eq("id", p.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "New post" : "Edit post"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Title *</Label>
              <Input value={p.title} onChange={(e) => { patch("title", e.target.value); if (isNew && !p.slug) patch("slug", slugify(e.target.value)); }} />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={p.slug} onChange={(e) => patch("slug", slugify(e.target.value))} placeholder="my-post" />
            </div>
          </div>
          <div>
            <Label>Excerpt</Label>
            <Textarea rows={2} value={p.excerpt ?? ""} onChange={(e) => patch("excerpt", e.target.value)} placeholder="Short summary for cards and social previews" />
          </div>
          <ImageUploadField label="Cover image" value={p.cover_image} onChange={(u) => patch("cover_image", u)} folder="blog/covers" hint="Also used as Open Graph image when no OG override is set." />
          <ImageUploadField label="OG image override (optional)" value={p.og_image} onChange={(u) => patch("og_image", u)} folder="blog/og" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>SEO title (optional)</Label><Input value={p.seo_title ?? ""} onChange={(e) => patch("seo_title", e.target.value)} /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={(p.tags ?? []).join(", ")} onChange={(e) => patch("tags", e.target.value.split(",").map(x => x.trim()).filter(Boolean))} /></div>
          </div>
          <div><Label>SEO description (optional)</Label><Textarea rows={2} value={p.seo_description ?? ""} onChange={(e) => patch("seo_description", e.target.value)} /></div>
          <div>
            <Label>Body (markdown)</Label>
            <Textarea rows={14} value={p.body} onChange={(e) => patch("body", e.target.value)} className="font-mono text-sm" />
            <p className="text-[11px] text-muted-foreground mt-1">~{readingMinutes(p.body)} min read</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={saving} onClick={() => save("draft")}>Save draft</Button>
          <Button disabled={saving} onClick={() => save("published")}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {p.status === "published" ? "Save & keep published" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Slides ---------------- */

function SlidesAdmin() {
  const qc = useQueryClient();
  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["admin-slides"],
    queryFn: async () => (await (supabase as any).from("cms_home_slides").select("*").order("sort_order")).data ?? [],
  });
  async function upsert(s: any) {
    const { error } = await (supabase as any).from("cms_home_slides").upsert(s);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-slides"] });
    qc.invalidateQueries({ queryKey: ["cms-home-slides"] });
  }
  async function del(id: string) {
    await (supabase as any).from("cms_home_slides").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-slides"] });
  }
  return (
    <Card className="p-6 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Home hero slides</h2>
          <p className="text-xs text-muted-foreground">Rotating slides at the top of the home page.</p>
        </div>
        <Button size="sm" onClick={() => upsert({ headline: "New slide", sort_order: slides.length + 1, active: true })}><Plus className="h-4 w-4 mr-1" /> New slide</Button>
      </div>
      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : slides.map((s: any) => (
        <div key={s.id} className="border rounded-lg p-4 grid gap-3 sm:grid-cols-2">
          <div><Label>Headline</Label><Input defaultValue={s.headline} onBlur={(e) => upsert({ ...s, headline: e.target.value })} /></div>
          <div><Label>Subhead</Label><Input defaultValue={s.subhead ?? ""} onBlur={(e) => upsert({ ...s, subhead: e.target.value })} /></div>
          <div><Label>CTA label</Label><Input defaultValue={s.cta_label ?? ""} onBlur={(e) => upsert({ ...s, cta_label: e.target.value })} /></div>
          <div><Label>CTA URL</Label><Input defaultValue={s.cta_url ?? ""} onBlur={(e) => upsert({ ...s, cta_url: e.target.value })} /></div>
          <div className="sm:col-span-2">
            <ImageUploadField label="Slide background image" value={s.image_url} folder="slides" onChange={(url) => upsert({ ...s, image_url: url })} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => upsert({ ...s, active: !s.active })}>{s.active ? "Deactivate" : "Activate"}</Button>
            <Button size="sm" variant="destructive" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------------- Menu ---------------- */

function MenuAdmin() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["admin-menu"],
    queryFn: async () => (await (supabase as any).from("cms_menu_items").select("*").order("sort_order")).data ?? [],
  });
  async function upsert(m: any) {
    const { error } = await (supabase as any).from("cms_menu_items").upsert(m);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
    qc.invalidateQueries({ queryKey: ["cms-menu"] });
  }
  async function del(id: string) {
    await (supabase as any).from("cms_menu_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-menu"] });
  }
  return (
    <Card className="p-6 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => upsert({ location: "header", label: "New", url: "/", sort_order: 99 })}>+ Header item</Button>
        <Button size="sm" variant="outline" onClick={() => upsert({ location: "footer", label: "New", url: "/", sort_order: 99 })}>+ Footer item</Button>
      </div>
      {items.map((m: any) => (
        <div key={m.id} className="border rounded-lg p-3 grid grid-cols-7 gap-2 items-end">
          <div><Label className="text-xs">Location</Label><Input defaultValue={m.location} onBlur={(e) => upsert({ ...m, location: e.target.value })} /></div>
          <div><Label className="text-xs">Label</Label><Input defaultValue={m.label} onBlur={(e) => upsert({ ...m, label: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">URL</Label><Input defaultValue={m.url} onBlur={(e) => upsert({ ...m, url: e.target.value })} /></div>
          <div><Label className="text-xs">Group</Label><Input defaultValue={m.group_label ?? ""} placeholder="Product" onBlur={(e) => upsert({ ...m, group_label: e.target.value || null })} /></div>
          <div><Label className="text-xs">Sort</Label><Input type="number" defaultValue={m.sort_order} onBlur={(e) => upsert({ ...m, sort_order: parseInt(e.target.value) || 0 })} /></div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => upsert({ ...m, active: !m.active })}>{m.active ? "Off" : "On"}</Button>
            <Button size="sm" variant="destructive" onClick={() => del(m.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ---------------- Campaigns ---------------- */

function CampaignsAdmin() {
  const qc = useQueryClient();
  const { data: campaigns = [] } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => (await (supabase as any).from("cms_campaigns").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  async function upsert(c: any) {
    const { error } = await (supabase as any).from("cms_campaigns").upsert(c);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
  }
  async function del(id: string) {
    await (supabase as any).from("cms_campaigns").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
  }
  return (
    <Card className="p-6 space-y-3">
      <Button size="sm" onClick={() => upsert({ slug: `camp-${Date.now()}`, headline: "New campaign", cta_label: "Get started" })}><Plus className="h-4 w-4 mr-1" /> New campaign</Button>
      {campaigns.map((c: any) => (
        <details key={c.id} className="border rounded-lg p-4">
          <summary className="cursor-pointer flex items-center justify-between">
            <span className="font-medium">{c.headline}</span>
            <Badge variant={c.active ? "default" : "secondary"}>/campaign/{c.slug}</Badge>
          </summary>
          <div className="mt-4 grid gap-3">
            <div><Label>Slug</Label><Input defaultValue={c.slug} onBlur={(e) => upsert({ ...c, slug: e.target.value })} /></div>
            <div><Label>Headline</Label><Input defaultValue={c.headline} onBlur={(e) => upsert({ ...c, headline: e.target.value })} /></div>
            <div><Label>Subhead</Label><Textarea rows={2} defaultValue={c.subhead ?? ""} onBlur={(e) => upsert({ ...c, subhead: e.target.value })} /></div>
            <div><Label>CTA label</Label><Input defaultValue={c.cta_label} onBlur={(e) => upsert({ ...c, cta_label: e.target.value })} /></div>
            <ImageUploadField label="Hero image / banner" value={c.hero_image} folder="campaigns" onChange={(url) => upsert({ ...c, hero_image: url })} />
            <div><Label>Benefits (one per line)</Label>
              <Textarea rows={4} defaultValue={(c.benefits ?? []).join("\n")}
                onBlur={(e) => upsert({ ...c, benefits: e.target.value.split("\n").map((x: string) => x.trim()).filter(Boolean) })} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => upsert({ ...c, active: !c.active })}>{c.active ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="destructive" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </details>
      ))}
    </Card>
  );
}

/* ---------------- SEO ---------------- */

function SeoAdmin() {
  const qc = useQueryClient();
  const { data: seo, isLoading } = useQuery({
    queryKey: ["admin-seo"],
    queryFn: async () => (await (supabase as any).from("cms_seo_settings").select("*").eq("id", "global").maybeSingle()).data,
  });
  async function save(patch: any) {
    const { error } = await (supabase as any).from("cms_seo_settings").update(patch).eq("id", "global");
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["admin-seo"] });
  }
  if (isLoading || !seo) return <Loader2 className="h-6 w-6 animate-spin" />;
  return (
    <Card className="p-6 grid gap-3">
      <div><Label>Site name</Label><Input defaultValue={seo.site_name} onBlur={(e) => save({ site_name: e.target.value })} /></div>
      <div><Label>Default title</Label><Input defaultValue={seo.default_title} onBlur={(e) => save({ default_title: e.target.value })} /></div>
      <div><Label>Default description</Label><Textarea rows={2} defaultValue={seo.default_description} onBlur={(e) => save({ default_description: e.target.value })} /></div>
      <ImageUploadField label="Default Open Graph image" value={seo.default_og_image} folder="seo" hint="Used for social previews when a page doesn't set its own OG image." onChange={(url) => save({ default_og_image: url })} />
      <div className="grid sm:grid-cols-3 gap-3">
        <div><Label>Twitter handle</Label><Input defaultValue={seo.twitter_handle ?? ""} onBlur={(e) => save({ twitter_handle: e.target.value })} /></div>
        <div><Label>GA ID</Label><Input defaultValue={seo.ga_id ?? ""} onBlur={(e) => save({ ga_id: e.target.value })} /></div>
        <div><Label>GTM ID</Label><Input defaultValue={seo.gtm_id ?? ""} onBlur={(e) => save({ gtm_id: e.target.value })} /></div>
      </div>
      <div><Label>Meta Pixel ID</Label><Input defaultValue={seo.meta_pixel_id ?? ""} onBlur={(e) => save({ meta_pixel_id: e.target.value })} /></div>
      <div><Label>Default robots</Label><Input defaultValue={seo.robots_default} onBlur={(e) => save({ robots_default: e.target.value })} /></div>
    </Card>
  );
}
