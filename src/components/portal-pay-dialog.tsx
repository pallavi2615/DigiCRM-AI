import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const PAYMENT_METHODS = [
  { key: "bank_transfer", label: "Bank transfer / NEFT" },
  { key: "upi", label: "UPI" },
  { key: "cheque", label: "Cheque" },
];

/**
 * A client recording the fee they have paid. Money moves outside the app, so
 * the charge waits at "awaiting confirmation" until our team confirms it.
 */
export function PortalPayDialog({
  recordId,
  charge,
  trigger,
}: {
  recordId: string;
  /** An existing charge to settle, or nothing to record a new pack fee. */
  charge?: { id: string; label: string; amount: number } | undefined;
  trigger?: React.ReactNode;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(charge ? String(charge.amount) : "");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in again.");
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter the amount you paid.");
      if (reference.trim().length < 3) throw new Error("Enter the reference or UTR number from your bank.");

      const patch = {
        status: "pending_confirmation",
        method,
        reference: reference.trim(),
        payer_note: note.trim() || null,
        submitted_at: new Date(paidOn).toISOString(),
        submitted_by: user.id,
      };

      if (charge) {
        const { error } = await supabase.from("pack_payments").update(patch as never).eq("id", charge.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pack_payments").insert({
          record_id: recordId,
          kind: "pack_fee",
          label: "Pack fee",
          amount: amt,
          currency: "INR",
          created_by: user.id,
          ...patch,
        } as never);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["portal-payments"] });
      await qc.invalidateQueries({ queryKey: ["desk-payments"] });
      toast.success("Thanks — we will confirm your payment shortly");
      setOpen(false);
      setReference(""); setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <IndianRupee className="mr-2 h-4 w-4" />Pay pack fee
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{charge ? `Pay: ${charge.label}` : "Record your pack fee payment"}</DialogTitle>
          <DialogDescription>
            Transfer the amount to us, then enter the reference here. Our team confirms it and your receipt appears on this page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount paid (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>How did you pay?</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Reference / UTR</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR123456789" />
            </div>
            <div className="space-y-1.5">
              <Label>Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
