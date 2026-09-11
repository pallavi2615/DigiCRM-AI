import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Landmark, Loader2, Power, PowerOff, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { StaffGuard } from "@/components/staff-guard";

export const Route = createFileRoute("/_authenticated/fintech/lenders")({
  component: () => (
    <StaffGuard module="lenders">
      <LendersPage />
    </StaffGuard>
  ),
});

const LOAN_TYPES = ["personal", "home", "business", "lap", "auto", "education", "gold"];

function LendersPage() {
  const qc = useQueryClient();
  const { isManager, isAdmin } = useAuth();
  const canEdit = isManager;
  const [lenderOpen, setLenderOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<string | null>(null);
  const [lenderForm, setLenderForm] = useState<any>({ name: "", lender_type: "bank", roi_min: 0, roi_max: 0, processing_fee_pct: 0, payout_pct: 1, active: true });
  const [productForm, setProductForm] = useState<any>({ name: "", product_type: "personal", min_amount: 0, max_amount: 0, max_tenure_months: 60, roi_min: 0, roi_max: 0, payout_pct: 1 });

  const { data: lenders = [] } = useQuery({
    queryKey: ["lenders-full"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lenders").select("*").order("name");
      return (data ?? []) as any[];
    },
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-full"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("loan_products").select("*");
      return (data ?? []) as any[];
    },
  });

  const addLender = useMutation({
    mutationFn: async () => { const { error } = await (supabase as any).from("lenders").insert(lenderForm); if (error) throw error; },
    onSuccess: () => { toast.success("Lender added"); qc.invalidateQueries({ queryKey: ["lenders-full"] }); setLenderOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const addProduct = useMutation({
    mutationFn: async () => { const { error } = await (supabase as any).from("loan_products").insert({ ...productForm, lender_id: productOpen }); if (error) throw error; },
    onSuccess: () => { toast.success("Product added"); qc.invalidateQueries({ queryKey: ["products-full"] }); setProductOpen(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleLender = useMutation({
    mutationFn: async (l: any) => { const { error } = await (supabase as any).from("lenders").update({ active: !l.active }).eq("id", l.id); if (error) throw error; },
    onSuccess: () => { toast.success("Lender updated"); qc.invalidateQueries({ queryKey: ["lenders-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delLender = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("lenders").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Lender deleted"); qc.invalidateQueries({ queryKey: ["lenders-full"] }); qc.invalidateQueries({ queryKey: ["products-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delProduct = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("loan_products").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Product deleted"); qc.invalidateQueries({ queryKey: ["products-full"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-semibold">Lenders & Products</h2><p className="text-sm text-muted-foreground">Bank/NBFC master with loan product catalog</p></div>
        {canEdit && (
          <Dialog open={lenderOpen} onOpenChange={setLenderOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Lender</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Lender</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={lenderForm.name} onChange={(e) => setLenderForm({ ...lenderForm, name: e.target.value })} /></div>
                <div><Label className="text-xs">Type</Label>
                  <Select value={lenderForm.lender_type} onValueChange={(v) => setLenderForm({ ...lenderForm, lender_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="bank">Bank</SelectItem><SelectItem value="nbfc">NBFC</SelectItem><SelectItem value="fintech">Fintech</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Payout %</Label><Input type="number" step="0.01" value={lenderForm.payout_pct} onChange={(e) => setLenderForm({ ...lenderForm, payout_pct: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">ROI min %</Label><Input type="number" step="0.01" value={lenderForm.roi_min} onChange={(e) => setLenderForm({ ...lenderForm, roi_min: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">ROI max %</Label><Input type="number" step="0.01" value={lenderForm.roi_max} onChange={(e) => setLenderForm({ ...lenderForm, roi_max: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Processing Fee %</Label><Input type="number" step="0.01" value={lenderForm.processing_fee_pct} onChange={(e) => setLenderForm({ ...lenderForm, processing_fee_pct: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => addLender.mutate()} disabled={addLender.isPending || !lenderForm.name}>{addLender.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3">
        {lenders.map((l: any) => {
          const lp = products.filter((p: any) => p.lender_id === l.id);
          return (
            <Card key={l.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Landmark className="h-4 w-4" /></div>
                    {l.name}
                    <Badge variant="outline" className="uppercase text-[10px]">{l.lender_type}</Badge>
                    {!l.active && <Badge variant="secondary">Inactive</Badge>}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>ROI {l.roi_min}–{l.roi_max}%</span>
                    <span>PF {l.processing_fee_pct}%</span>
                    <span className="font-semibold text-primary">Payout {l.payout_pct}%</span>
                    {canEdit && <Button size="sm" variant="outline" onClick={() => setProductOpen(l.id)}><Plus className="h-3 w-3 mr-1" />Product</Button>}
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => toggleLender.mutate(l)}>
                          {l.active ? <><PowerOff className="h-3 w-3 mr-1" />Deactivate</> : <><Power className="h-3 w-3 mr-1" />Activate</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${l.name}? Its products will be removed too.`)) delLender.mutate(l.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {lp.length === 0 ? <p className="text-xs text-muted-foreground">No products</p> : (
                  <div className="flex flex-wrap gap-2">
                    {lp.map((p: any) => (
                      <div key={p.id} className="px-3 py-1.5 rounded-lg border bg-card text-xs flex items-start gap-2">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-muted-foreground">{p.product_type} · ROI {p.roi_min}-{p.roi_max}% · Payout {p.payout_pct}%</div>
                        </div>
                        {isAdmin && (
                          <button type="button" aria-label={`Delete ${p.name}`} className="text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Delete product ${p.name}?`)) delProduct.mutate(p.id); }}>
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!productOpen} onOpenChange={(v) => !v && setProductOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Loan Product</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={productForm.product_type} onValueChange={(v) => setProductForm({ ...productForm, product_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Payout %</Label><Input type="number" step="0.01" value={productForm.payout_pct} onChange={(e) => setProductForm({ ...productForm, payout_pct: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Min Amount</Label><Input type="number" value={productForm.min_amount} onChange={(e) => setProductForm({ ...productForm, min_amount: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Max Amount</Label><Input type="number" value={productForm.max_amount} onChange={(e) => setProductForm({ ...productForm, max_amount: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">ROI min %</Label><Input type="number" step="0.01" value={productForm.roi_min} onChange={(e) => setProductForm({ ...productForm, roi_min: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">ROI max %</Label><Input type="number" step="0.01" value={productForm.roi_max} onChange={(e) => setProductForm({ ...productForm, roi_max: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Max Tenure (months)</Label><Input type="number" value={productForm.max_tenure_months} onChange={(e) => setProductForm({ ...productForm, max_tenure_months: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button onClick={() => addProduct.mutate()} disabled={addProduct.isPending || !productForm.name}>Add</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
