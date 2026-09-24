import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, ArrowRight, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api"; // adjust to wherever this file lives

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation — DigiCRM AI" }] }),
  component: AutomationPage,
});

interface AutomationRule {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  rule_type: string;
  trigger_event: string | null;
  trigger_schedule: string | null;
  trigger_condition: Record<string, unknown>;
  entity_type: string;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

function formatTrigger(rule: AutomationRule) {
  if (rule.trigger_event) return rule.trigger_event.replace(/_/g, " ");
  if (rule.trigger_schedule) return `Schedule: ${rule.trigger_schedule}`;
  return "No trigger set";
}

function formatAction(rule: AutomationRule) {
  return rule.action_type.replace(/_/g, " ");
}

function AutomationPage() {
  const queryClient = useQueryClient();

  const {
    data: rules,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: () => apiFetch<AutomationRule[]>("/api/v1/automation/rules"),
  });

  const toggleMutation = useMutation({
    mutationFn: (ruleId: number) =>
      apiFetch<AutomationRule>(`/api/v1/automation/rules/${ruleId}/toggle`, {
        method: "PATCH",
      }),
    onMutate: async (ruleId) => {
      await queryClient.cancelQueries({ queryKey: ["automation-rules"] });
      const previous = queryClient.getQueryData<AutomationRule[]>(["automation-rules"]);
      queryClient.setQueryData<AutomationRule[]>(["automation-rules"], (old) =>
        old?.map((r) => (r.id === ruleId ? { ...r, is_active: !r.is_active } : r))
      );
      return { previous };
    },
    onError: (err, _ruleId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["automation-rules"], context.previous);
      }
      toast.error(err instanceof Error ? err.message : "Failed to toggle rule");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" /> Automation
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up rules to run repetitive sales tasks automatically.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error instanceof Error ? error.message : "Failed to load automation rules"}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-3">
          {rules?.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No automation rules yet.
              </CardContent>
            </Card>
          )}

          {rules?.map((r) => (
            <Card key={r.id} className="shadow-card">
              <CardContent className="p-4 flex items-center gap-4">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    r.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{r.name}</h4>
                    <Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">
                      {r.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-muted">{formatTrigger(r)}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="px-2 py-0.5 rounded bg-muted">{formatAction(r)}</span>
                  </div>
                </div>
                <Switch
                  checked={r.is_active}
                  disabled={toggleMutation.isPending}
                  onCheckedChange={() => toggleMutation.mutate(r.id)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="shadow-card border-dashed">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Custom workflow builder with conditional branches, webhooks, and multi-step actions coming next.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}