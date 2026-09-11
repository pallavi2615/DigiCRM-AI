import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { StaffGuard } from "@/components/staff-guard";
import { escapePostgrestFilterValue } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/productsales/products")({
  component: () => (
    <StaffGuard module="ps_products">
      <ProductsPage />
    </StaffGuard>
  ),
});

function ProductsPage() {
  const qc = useQueryClient();
  const { user, isManager, isAdmin } = useAuth();
  const canWrite = isManager || isAdmin;
  const canDelete = isAdmin;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const empty = { sku: "", name: "", category: "", description: "", price: "", cost: "", stock: "0", commission_pct: "5", active: true };
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ps-products", q],
    queryFn: async () => {
      let query = (supabase as any).from("ps_products").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`name.ilike.%${escapePostgrestFilterValue(q)}%,sku.ilike.%${escapePostgrestFilterValue(q)}%,category.ilike.%${escapePostgrestFilterValue(q)}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    const payload = {
      ...form,
      price: Number(form.price || 0),
      cost: Number(form.cost || 0),
      stock: Number(form.stock || 0),
      commission_pct: Number(form.commission_pct || 0),
      owner_id: edit?.owner_id ?? user?.id,
    };
    const { error } = edit
      ? await (supabase as any).from("ps_products").update(payload).eq("id", edit.id)
      : await (supabase as any).from("ps_products").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(edit ? "Product updated" : "Product added");
    setOpen(false); setEdit(null); setForm(empty);
    qc.invalidateQueries({ queryKey: ["ps-products"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await (supabase as any).from("ps_products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ps-products"] });
  };

  const openEdit = (row: any) => {
    setEdit(row);
    setForm({ ...empty, ...row, price: row.price ?? "", cost: row.cost ?? "", stock: row.stock ?? 0, commission_pct: row.commission_pct ?? 0 });
    setOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Product Catalog</h2>
          <p className="text-sm text-muted-foreground">SKUs, pricing, stock and commission rates</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name/SKU" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          {canWrite && (
            <Button onClick={() => { setEdit(null); setForm(empty); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
          )}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
              <TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Commission</TableHead>
              <TableHead>Status</TableHead><TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No products yet.</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.category || "—"}</TableCell>
                <TableCell>₹{Number(r.price).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={r.stock < 10 ? "destructive" : "secondary"}>{r.stock}</Badge>
                </TableCell>
                <TableCell>{r.commission_pct}%</TableCell>
                <TableCell>{r.active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                <TableCell className="text-right">
                  {canWrite && <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>}
                  {canDelete && <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input placeholder="Cost" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <Input placeholder="Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            <Input placeholder="Commission %" type="number" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
            </label>
            <Textarea className="col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{edit ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
