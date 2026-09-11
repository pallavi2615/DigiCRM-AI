import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeTable } from "@/lib/use-realtime-table";

export const Route = createFileRoute("/_authenticated/fintech/pipeline")({
  component: FintechPipelinePage,
});

type Stage = "new" | "docs_pending" | "docs_collected" | "login" | "under_review" | "sanctioned" | "disbursed" | "rejected" | "on_hold";

const stages: { key: Stage; label: string; color: string }[] = [
  { key: "new", label: "New", color: "border-t-muted-foreground" },
  { key: "docs_pending", label: "Docs Pending", color: "border-t-warning" },
  { key: "docs_collected", label: "Docs Collected", color: "border-t-info" },
  { key: "login", label: "Login", color: "border-t-primary" },
  { key: "under_review", label: "Under Review", color: "border-t-accent-foreground" },
  { key: "sanctioned", label: "Sanctioned", color: "border-t-info" },
  { key: "disbursed", label: "Disbursed", color: "border-t-success" },
  { key: "rejected", label: "Rejected", color: "border-t-destructive" },
  { key: "on_hold", label: "On Hold", color: "border-t-muted-foreground" },
];

function FintechPipelinePage() {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["fintech-pipeline"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("loan_applications")
        .select("id, applicant_name, phone, loan_type, requested_amount, disbursed_amount, stage, updated_at")
        .is("deleted_at", null).order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const move = async (id: string, stage: Stage) => {
    const { error } = await (supabase as any).from("loan_applications").update({ stage }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${stage.replace(/_/g, " ")}`);
    qc.invalidateQueries({ queryKey: ["fintech-pipeline"] });
  };

  const inr = (n: any) => n ? "₹" + (Number(n) / 100000).toFixed(1) + "L" : "—";
  const ageDays = (d?: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0;
  const ageTone = (days: number) => days > 14 ? "bg-destructive/15 text-destructive" : days > 7 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground";

  useRealtimeTable("loan_applications", [["fintech-pipeline"], ["loan-apps"], ["fintech-apps"]]);

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;

  return (
    <div className="p-6 h-full overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-4">
        {stages.map((s) => {
          const items = apps.filter((a: any) => a.stage === s.key);
          const value = items.reduce((sum: number, a: any) => sum + Number(a.requested_amount || 0), 0);
          return (
            <div key={s.key} className="w-72 flex-shrink-0" onDragOver={(e) => e.preventDefault()} onDrop={() => dragId && move(dragId, s.key)}>
              <Card className={`border-t-4 ${s.color} p-3 mb-2`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{s.label}</div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><IndianRupee className="h-3 w-3" />{inr(value)}</div>
              </Card>
              <div className="space-y-2">
                {items.map((a: any) => (
                  <Card key={a.id} draggable onDragStart={() => setDragId(a.id)} onDragEnd={() => setDragId(null)}
                    className="p-3 cursor-move hover:shadow-elegant transition-shadow">
                    <div className="font-medium text-sm">{a.applicant_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.phone || "—"}</div>
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{a.loan_type}</Badge>
                      <span className="text-xs font-semibold">{inr(a.requested_amount)}</span>
                    </div>
                    <div className="mt-2">
                      <Badge className={`text-[10px] ${ageTone(ageDays(a.updated_at))}`}>
                        {ageDays(a.updated_at)}d in stage
                      </Badge>
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
