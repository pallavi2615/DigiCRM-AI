import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { IndustryPack } from "@/lib/industry-packs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

/** Lets a client start a new application in one of the packs open to them. */
export function PortalApplyDialog({ packs }: { packs: IndustryPack[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [packKey, setPackKey] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const pack = packs.find((p) => `${p.group}::${p.slug}` === packKey);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in again.");
      if (!pack) throw new Error("Choose what you are applying for.");
      if (title.trim().length < 3) throw new Error("Give your application a short title.");

      const { error } = await supabase.from("pack_records").insert({
        group_slug: pack.group,
        pack_slug: pack.slug,
        title: title.trim(),
        stage: pack.stages[0] ?? "New",
        value: value ? Number(value) : null,
        contact_name: name.trim() || null,
        contact_email: user.email ?? null,
        contact_phone: phone.trim() || null,
        city: city.trim() || null,
        notes: notes.trim() || null,
        owner_id: user.id,
        created_by: user.id,
      } as never);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["portal-records"] });
      toast.success("Application submitted — upload your documents next");
      setOpen(false);
      setTitle(""); setName(""); setPhone(""); setCity(""); setValue(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />New application</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a new application</DialogTitle>
          <DialogDescription>Tell us what you need. You can upload documents once it is created.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>What are you applying for?</Label>
            <Select value={packKey} onValueChange={setPackKey}>
              <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {packs.map((p) => (
                  <SelectItem key={`${p.group}::${p.slug}`} value={`${p.group}::${p.slug}`}>
                    {p.groupName} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={pack ? `${pack.recordLabel} for…` : "Short description"} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Your name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{pack?.valueLabel ?? "Amount"} (₹)</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Anything we should know?</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
