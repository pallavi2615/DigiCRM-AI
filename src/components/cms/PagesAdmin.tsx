import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ImageUploadField } from "@/components/cms/ImageUploadField";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, ExternalLink } from "lucide-react";

type Block = {
  type: "heading" | "text" | "image" | "cta" | "features" | "faq";
  text?: string;
  label?: string;
  url?: string;
  image?: string;
  items?: Array<{ title?: string; text?: string; q?: string; a?: string }>;
};

type Page = {
  id?: string;
  slug: string;
  title: string;
  meta_description: string | null;
  seo_keywords: string | null;
  og_image: string | null;
  canonical_override: string | null;
  noindex: boolean;
  hero: { headline?: string; subhead?: string; image?: string };
  body: Block[];
  status: "draft" | "published";
  published_at?: string | null;
};

const EMPTY: Page = {
  slug: "", title: "", meta_description: "", seo_keywords: "", og_image: null,
  canonical_override: "", noindex: false, hero: { headline: "", subhead: "" },
  body: [{ type: "text", text: "" }], status: "draft",
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export function PagesAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Page | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["admin-pages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cms_pages")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Page[];
    },
  });

  async function togglePublish(p: Page) {
    const next = p.status === "published" ? "draft" : "published";
    const { error } = await (supabase as any)
      .from("cms_pages")
      .update({ status: next, published_at: next === "published" ? (p.published_at ?? new Date().toISOString()) : p.published_at })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["admin-pages"] });
  }

  async function del(id: string) {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    const { error } = await (supabase as any).from("cms_pages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-pages"] });
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Marketing pages</h2>
          <p className="text-xs text-muted-foreground">
            Block-based pages published at /p/&lt;slug&gt; with their own SEO metadata.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="h-4 w-4 mr-1" /> New page</Button>
      </div>

      {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : pages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No pages yet.</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {pages.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.title || "(untitled)"}</span>
                  <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
                  {p.noindex && <Badge variant="outline">noindex</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">/p/{p.slug}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => togglePublish(p)}>
                {p.status === "published" ? "Unpublish" : "Publish"}
              </Button>
              {p.status === "published" && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={`/p/${p.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => del(p.id!)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PageEditor
          page={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["admin-pages"] }); }}
        />
      )}
    </Card>
  );
}

function PageEditor({ page, onClose, onSaved }: { page: Page; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState<Page>(page);
  const [saving, setSaving] = useState(false);
  const isNew = !p.id;

  function patch<K extends keyof Page>(k: K, v: Page[K]) { setP((prev) => ({ ...prev, [k]: v })); }
  function setBlock(i: number, b: Block) { patch("body", p.body.map((x, ix) => (ix === i ? b : x))); }
  function addBlock(type: Block["type"]) {
    const base: Block = type === "features" || type === "faq" ? { type, items: [{}] } : { type };
    patch("body", [...p.body, base]);
  }
  function removeBlock(i: number) { patch("body", p.body.filter((_, ix) => ix !== i)); }
  function move(i: number, dir: -1 | 1) {
    const next = [...p.body];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    patch("body", next);
  }

  async function save(status?: Page["status"]) {
    const slug = (p.slug || slugify(p.title)).trim();
    if (!slug || !p.title.trim()) return toast.error("Title and slug are required");
    const payload: Record<string, unknown> = {
      slug, title: p.title, meta_description: p.meta_description, seo_keywords: p.seo_keywords,
      og_image: p.og_image, canonical_override: p.canonical_override || null, noindex: p.noindex,
      hero: p.hero, body: p.body, status: status ?? p.status,
    };
    if ((status ?? p.status) === "published") payload["published_at"] = p.published_at ?? new Date().toISOString();
    setSaving(true);
    const { error } = isNew
      ? await (supabase as any).from("cms_pages").insert(payload)
      : await (supabase as any).from("cms_pages").update(payload).eq("id", p.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew ? "New page" : "Edit page"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Title *</Label>
              <Input value={p.title} onChange={(e) => { patch("title", e.target.value); if (isNew && !p.slug) patch("slug", slugify(e.target.value)); }} />
            </div>
            <div>
              <Label>Slug * (/p/…)</Label>
              <Input value={p.slug} onChange={(e) => patch("slug", slugify(e.target.value))} />
            </div>
          </div>
          <div><Label>Meta description</Label><Textarea rows={2} value={p.meta_description ?? ""} onChange={(e) => patch("meta_description", e.target.value)} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>SEO keywords</Label><Input value={p.seo_keywords ?? ""} onChange={(e) => patch("seo_keywords", e.target.value)} /></div>
            <div><Label>Canonical override</Label><Input value={p.canonical_override ?? ""} onChange={(e) => patch("canonical_override", e.target.value)} placeholder="https://…" /></div>
          </div>
          <ImageUploadField label="Open Graph image" value={p.og_image} folder="pages/og" onChange={(u) => patch("og_image", u)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.noindex} onChange={(e) => patch("noindex", e.target.checked)} />
            Hide this page from search engines (noindex)
          </label>

          <div className="border rounded-lg p-4 grid gap-3">
            <h3 className="text-sm font-semibold">Hero</h3>
            <div><Label>Headline</Label><Input value={p.hero.headline ?? ""} onChange={(e) => patch("hero", { ...p.hero, headline: e.target.value })} /></div>
            <div><Label>Subhead</Label><Textarea rows={2} value={p.hero.subhead ?? ""} onChange={(e) => patch("hero", { ...p.hero, subhead: e.target.value })} /></div>
            <ImageUploadField label="Hero image" value={p.hero.image ?? null} folder="pages/hero" onChange={(u) => patch("hero", { ...p.hero, image: u ?? "" })} />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Content blocks</h3>
              <div className="flex flex-wrap gap-1">
                {(["heading", "text", "image", "features", "faq", "cta"] as const).map((t) => (
                  <Button key={t} size="sm" variant="outline" onClick={() => addBlock(t)}>+ {t}</Button>
                ))}
              </div>
            </div>
            {p.body.map((b, i) => (
              <div key={i} className="border rounded-lg p-3 grid gap-2">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{b.type}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)}>↑</Button>
                    <Button size="sm" variant="ghost" onClick={() => move(i, 1)}>↓</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeBlock(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {(b.type === "heading" || b.type === "text" || b.type === "cta") && (
                  <Textarea rows={b.type === "text" ? 4 : 1} value={b.text ?? ""} placeholder="Text" onChange={(e) => setBlock(i, { ...b, text: e.target.value })} />
                )}
                {b.type === "cta" && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input value={b.label ?? ""} placeholder="Button label" onChange={(e) => setBlock(i, { ...b, label: e.target.value })} />
                    <Input value={b.url ?? ""} placeholder="/contact" onChange={(e) => setBlock(i, { ...b, url: e.target.value })} />
                  </div>
                )}
                {b.type === "image" && (
                  <ImageUploadField label="Image" value={b.image ?? null} folder="pages/blocks" onChange={(u) => setBlock(i, { ...b, image: u ?? "" })} />
                )}
                {(b.type === "features" || b.type === "faq") && (
                  <div className="grid gap-2">
                    {(b.items ?? []).map((it, ix) => (
                      <div key={ix} className="grid sm:grid-cols-2 gap-2">
                        <Input
                          placeholder={b.type === "faq" ? "Question" : "Title"}
                          value={(b.type === "faq" ? it.q : it.title) ?? ""}
                          onChange={(e) => {
                            const items = [...(b.items ?? [])];
                            items[ix] = b.type === "faq" ? { ...it, q: e.target.value } : { ...it, title: e.target.value };
                            setBlock(i, { ...b, items });
                          }}
                        />
                        <Input
                          placeholder={b.type === "faq" ? "Answer" : "Description"}
                          value={(b.type === "faq" ? it.a : it.text) ?? ""}
                          onChange={(e) => {
                            const items = [...(b.items ?? [])];
                            items[ix] = b.type === "faq" ? { ...it, a: e.target.value } : { ...it, text: e.target.value };
                            setBlock(i, { ...b, items });
                          }}
                        />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setBlock(i, { ...b, items: [...(b.items ?? []), {}] })}>+ item</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" disabled={saving} onClick={() => save("draft")}>Save draft</Button>
          <Button disabled={saving} onClick={() => save("published")}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
