import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/it/pipeline")({
  component: ITPipeline,
});

type Stage = "discovery" | "proposal" | "negotiation" | "contract" | "kickoff" | "in_progress" | "uat" | "delivered" | "closed";

const stages: { key: Stage; label: string; color: string }[] = [
  { key: "discovery", label: "Discovery", color: "border-t-muted-foreground" },
  { key: "proposal", label: "Proposal", color: "border-t-info" },
  { key: "negotiation", label: "Negotiation", color: "border-t-warning" },
  { key: "contract", label: "Contract", color: "border-t-primary" },
  { key: "kickoff", label: "Kickoff", color: "border-t-primary" },
  { key: "in_progress", label: "In Progress", color: "border-t-accent-foreground" },
  { key: "uat", label: "UAT", color: "border-t-info" },
  { key: "delivered", label: "Delivered", color: "border-t-success" },
  { key: "closed", label: "Closed", color: "border-t-success" },
];

function ITPipeline() {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["it-pipeline"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("it_projects")
        .select("id, name, client_name, tech_stack, value, stage")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const move = async (id: string, stage: Stage) => {
    const { error } = await (supabase as any).from("it_projects").update({ stage }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${stage.replace(/_/g, " ")}`);
    qc.invalidateQueries({ queryKey: ["it-pipeline"] });
  };

  const inr = (n: any) => n ? "₹" + (Number(n) / 100000).toFixed(1) + "L" : "—";

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 h-full overflow-x-auto">
      <div className="mb-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Engagement Pipeline · 9 Stages</h2>
        <p className="text-sm text-muted-foreground">Discovery to delivery — drag to change stage</p>
      </div>
      <div className="flex gap-3 min-w-max pb-4">
        {stages.map((s) => {
          const items = projects.filter((p: any) => p.stage === s.key);
          const value = items.reduce((sum: number, p: any) => sum + Number(p.value || 0), 0);
          return (
            <div key={s.key} className="w-72 flex-shrink-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && move(dragId, s.key)}>
              <Card className={`border-t-4 ${s.color} p-3 mb-2`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{s.label}</div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><IndianRupee className="h-3 w-3" />{inr(value)}</div>
              </Card>
              <div className="space-y-2">
                {items.map((p: any) => (
                  <Card key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)}
                    className="p-3 cursor-move hover:shadow-elegant transition-shadow">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{p.client_name || "—"}</div>
                    {p.tech_stack && <div className="text-[10px] mt-1 text-muted-foreground truncate">{p.tech_stack}</div>}
                    <div className="flex items-center justify-end mt-2">
                      <span className="text-xs font-semibold">{inr(p.value)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
