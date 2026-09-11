import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Loader2, Download, Images, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { escapePostgrestFilterValue } from "@/lib/utils";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { downloadCsv, objectsToCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/realestate/properties")({
  component: PropertiesPage,
});

const TYPES = ["apartment", "villa", "plot", "commercial", "office"];
const STATUS = ["available", "hold", "sold", "rented"];

function PropertiesPage() {
  const qc = useQueryClient();
  const { user, isManager, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const empty = { title: "", property_type: "apartment", city: "", address: "", price: "", bedrooms: "", bathrooms: "", area_sqft: "", status: "available", description: "" };
  const [form, setForm] = useState<any>(empty);
  const [photoOf, setPhotoOf] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["re-props", q],
    queryFn: async () => {
      let query = (supabase as any).from("re_properties").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`title.ilike.%${escapePostgrestFilterValue(q)}%,city.ilike.%${escapePostgrestFilterValue(q)}%,address.ilike.%${escapePostgrestFilterValue(q)}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    const payload = {
      ...form,
      price: form.price ? Number(form.price) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
      owner_id: edit?.owner_id ?? user?.id,
    };
    const { error } = edit
      ? await (supabase as any).from("re_properties").update(payload).eq("id", edit.id)
      : await (supabase as any).from("re_properties").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(edit ? "Property updated" : "Property added");
    setOpen(false); setEdit(null); setForm(empty);
    qc.invalidateQueries({ queryKey: ["re-props"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    const { error } = await (supabase as any).from("re_properties").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["re-props"] });
  };

  const openEdit = (row: any) => {
    setEdit(row);
    setForm({ ...empty, ...row, price: row.price ?? "", bedrooms: row.bedrooms ?? "", bathrooms: row.bathrooms ?? "", area_sqft: row.area_sqft ?? "" });
    setOpen(true);
  };

  useRealtimeTable("re_properties", [["re-props"], ["re-props-kpi"]]);

  const exportCsv = () => {
    const headers = ["title", "property_type", "city", "address", "price", "bedrooms", "bathrooms", "area_sqft", "status", "created_at"];
    const out = rows.map((r: any) => Object.fromEntries(headers.map((h) => [h, r[h]])));
    downloadCsv(`re-properties-${Date.now()}.csv`, objectsToCsv(out as never, headers));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Properties</h2>
          <p className="text-sm text-muted-foreground">Inventory of listings across all cities</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search title/city" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Property</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>City</TableHead>
              <TableHead>Price</TableHead><TableHead>Config</TableHead><TableHead>Status</TableHead><TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No properties yet.</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.title}
                  {Array.isArray(r.images) && r.images.length > 0 && (
                    <span className="ml-2 text-[10px] text-muted-foreground">· {r.images.length} photo{r.images.length > 1 ? "s" : ""}</span>
                  )}
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.property_type}</Badge></TableCell>
                <TableCell className="text-sm">{r.city}</TableCell>
                <TableCell className="text-sm">{r.price ? `₹${(r.price/100000).toFixed(1)}L` : "—"}</TableCell>
                <TableCell className="text-xs">{r.bedrooms || 0}BHK · {r.area_sqft || "—"} sqft</TableCell>
                <TableCell><Badge variant={r.status === "sold" ? "default" : "secondary"} className="capitalize">{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" title="Photos" onClick={() => setPhotoOf(r)}><Images className="h-4 w-4" /></Button>
                  {(isManager || r.owner_id === user?.id) && <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit Property" : "New Property"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 py-2">
            <Input className="md:col-span-2" placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input placeholder="Area (sqft)" type="number" value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: e.target.value })} />
            <Input placeholder="Bedrooms" type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            <Input placeholder="Bathrooms" type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            <Textarea className="md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={!form.title}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotosDialog property={photoOf} onClose={() => setPhotoOf(null)} />
    </div>
  );
}

function PhotosDialog({ property, onClose }: { property: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: row } = useQuery({
    queryKey: ["re-prop", property?.id],
    enabled: !!property,
    queryFn: async () => (await (supabase as any).from("re_properties").select("id, title, images").eq("id", property.id).single()).data,
  });
  const photos: any[] = Array.isArray(row?.images) ? row.images : [];

  const { data: urls = {} } = useQuery({
    queryKey: ["re-prop-photo-urls", property?.id, photos.map((p) => p.path).join(",")],
    enabled: photos.length > 0,
    queryFn: async () => {
      const { data } = await supabase.storage.from("attachments").createSignedUrls(photos.map((p) => p.path), 600);
      const map: Record<string, string> = {};
      (data ?? []).forEach((d: any) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl; });
      return map;
    },
  });

  const upload = async (file: File) => {
    if (!property) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image"); return; }
    setBusy(true);
    try {
      const path = `re_properties/${property.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const next = [...photos, { path, name: file.name, uploaded_at: new Date().toISOString() }];
      const { error: upErr } = await (supabase as any).from("re_properties").update({ images: next }).eq("id", property.id);
      if (upErr) throw upErr;
      toast.success("Photo added");
      qc.invalidateQueries({ queryKey: ["re-prop", property.id] });
      qc.invalidateQueries({ queryKey: ["re-props"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (path: string) => {
    if (!property) return;
    await supabase.storage.from("attachments").remove([path]);
    const next = photos.filter((p) => p.path !== path);
    const { error } = await (supabase as any).from("re_properties").update({ images: next }).eq("id", property.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["re-prop", property.id] });
    qc.invalidateQueries({ queryKey: ["re-props"] });
  };

  return (
    <Dialog open={!!property} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Photos · {property?.title}</DialogTitle></DialogHeader>
        <label className="flex items-center gap-2 border border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/30">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="text-sm">Upload listing photo</span>
          <input type="file" accept="image/*" className="hidden" disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No photos yet</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {photos.map((p) => (
              <div key={p.path} className="relative group rounded-lg overflow-hidden border">
                {urls[p.path]
                  ? <img src={urls[p.path]} alt={p.name} className="h-28 w-full object-cover" loading="lazy" />
                  : <div className="h-28 w-full bg-muted animate-pulse" />}
                <button type="button" aria-label="Remove photo" onClick={() => remove(p.path)}
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
