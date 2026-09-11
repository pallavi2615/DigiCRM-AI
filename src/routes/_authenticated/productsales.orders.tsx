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
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { escapePostgrestFilterValue } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/productsales/orders")({
  component: OrdersPage,
});

const STATUSES = ["draft", "sent", "confirmed", "fulfilled", "cancelled"];

function OrdersPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const empty = { kind: "order", customer_name: "", customer_email: "", customer_phone: "", status: "draft", discount: "0", tax: "0", notes: "" };
  const [form, setForm] = useState<any>(empty);
  const [items, setItems] = useState<any[]>([]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ps-orders", q],
    queryFn: async () => {
      let query = (supabase as any).from("ps_orders").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`customer_name.ilike.%${escapePostgrestFilterValue(q)}%,order_no.ilike.%${escapePostgrestFilterValue(q)}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["ps-products-lite"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("ps_products").select("id, name, sku, price").eq("active", true);
      return data || [];
    },
  });

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0);
  const total = subtotal + Number(form.tax || 0) - Number(form.discount || 0);

  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: 1, unit_price: 0 }]);
  const updateItem = (i: number, patch: any) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const openEdit = async (row: any) => {
    setEdit(row);
    setForm({ ...empty, ...row });
    const { data } = await (supabase as any).from("ps_order_items").select("*").eq("order_id", row.id);
    setItems(data || []);
    setOpen(true);
  };

  const openNew = () => { setEdit(null); setForm(empty); setItems([]); setOpen(true); };

  const save = async () => {
    if (!form.customer_name) { toast.error("Customer name required"); return; }
    if (items.length === 0) { toast.error("Add at least one line item"); return; }
    const payload = {
      kind: form.kind,
      customer_name: form.customer_name,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      status: form.status,
      subtotal, tax: Number(form.tax || 0), discount: Number(form.discount || 0), total,
      notes: form.notes || null,
      owner_id: edit?.owner_id ?? user?.id,
      assigned_to: edit?.assigned_to ?? user?.id,
    };
    let orderId = edit?.id;
    if (edit) {
      const { error } = await (supabase as any).from("ps_orders").update(payload).eq("id", edit.id);
      if (error) { toast.error(error.message); return; }
      await (supabase as any).from("ps_order_items").delete().eq("order_id", edit.id);
    } else {
      const { data, error } = await (supabase as any).from("ps_orders").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      orderId = data.id;
    }
    const lineItems = items.map((it) => ({
      order_id: orderId,
      product_id: it.product_id || null,
      product_name: it.product_name,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      line_total: Number(it.quantity) * Number(it.unit_price),
    }));
    if (lineItems.length) {
      const { error } = await (supabase as any).from("ps_order_items").insert(lineItems);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(edit ? "Order updated" : "Order created");
    setOpen(false); setEdit(null); setForm(empty); setItems([]);
    qc.invalidateQueries({ queryKey: ["ps-orders"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this order?")) return;
    const { error } = await (supabase as any).from("ps_orders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ps-orders"] });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Quotes & Orders</h2>
          <p className="text-sm text-muted-foreground">Draft quotes, confirm orders — commissions post automatically</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search customer/order#" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New</Button>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead><TableHead>Kind</TableHead><TableHead>Customer</TableHead>
              <TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No quotes or orders yet.</TableCell></TableRow>
            ) : rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.order_no}</TableCell>
                <TableCell><Badge variant="outline">{r.kind}</Badge></TableCell>
                <TableCell className="font-medium">{r.customer_name}</TableCell>
                <TableCell><Badge variant={r.status === "confirmed" || r.status === "fulfilled" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                <TableCell>₹{Number(r.total).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  {isAdmin && <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? `Edit ${edit.order_no}` : "New Quote / Order"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quote">Quote</SelectItem>
                  <SelectItem value="order">Order</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Customer name" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              <Input placeholder="Customer email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
              <Input placeholder="Customer phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </div>

            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">Line Items</p>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
              </div>
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No items — click "Add Line"</p>}
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Select value={it.product_id || ""} onValueChange={(v) => {
                    const p = products.find((x: any) => x.id === v);
                    updateItem(i, { product_id: v, product_name: p?.name || it.product_name, unit_price: p?.price ?? it.unit_price });
                  }}>
                    <SelectTrigger className="col-span-5"><SelectValue placeholder="Pick product" /></SelectTrigger>
                    <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="col-span-2" type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
                  <Input className="col-span-3" type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} />
                  <div className="col-span-1 text-sm">₹{(Number(it.quantity || 0) * Number(it.unit_price || 0)).toFixed(0)}</div>
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input placeholder="Discount" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
              <Input placeholder="Tax" type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} />
              <div className="flex items-center justify-end font-bold">Total: ₹{total.toLocaleString()}</div>
            </div>
            <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{edit ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
