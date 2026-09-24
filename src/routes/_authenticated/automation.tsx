import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  ArrowRight,
  AlertCircle,
  ScrollText,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation — DigiCRM AI" }] }),
  component: AutomationPage,
});

// Matches the ACTUAL /api/v1/automation/rules response
export interface AutomationRule {
  id: number;
  tenant_id: number;
  rule_key: string;
  name: string;
  description: string | null;
  trigger_text: string | null;
  action_text: string | null;
  rule_type: string; // "event" | "time" (observed values)
  is_active: boolean;
  updated_at: string;
}

// Matches the ACTUAL /api/v1/automation/logs response
export interface AutomationLog {
  id: number;
  tenant_id: number;
  rule_id: number;
  entity_type: string;
  entity_id: number;
  action_taken: string;
  result: string; // "success" observed — treat anything else as failure
  error_message: string | null;
  executed_at: string;
}

function ruleTypeLabel(ruleType: string) {
  if (ruleType === "event") return "Event-based";
  if (ruleType === "time") return "Scheduled";
  return ruleType || "Unknown";
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AutomationPage() {
  const queryClient = useQueryClient();

  const {
    data: rules,
    isLoading: rulesLoading,
    isError: rulesError,
    error: rulesErrorObj,
  } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: () => apiFetch<AutomationRule[]>("/api/v1/automation/rules"),
  });

  const {
    data: logs,
    isLoading: logsLoading,
    isError: logsError,
  } = useQuery({
    queryKey: ["automation-logs"],
    queryFn: () => apiFetch<AutomationLog[]>("/api/v1/automation/logs"),
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

  const ruleNameById = new Map((rules ?? []).map((r) => [r.id, r.name]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-7 w-7 text-primary" /> Automation
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rules that run repetitive sales tasks automatically.
        </p>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        {/* ---------- RULES ---------- */}
        <TabsContent value="rules" className="space-y-3 mt-4">
          {rulesLoading && (
            <div className="grid gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}

          {rulesError && (
            <Card className="border-destructive/40">
              <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {rulesErrorObj instanceof Error
                  ? rulesErrorObj.message
                  : "Failed to load automation rules"}
              </CardContent>
            </Card>
          )}

          {!rulesLoading && !rulesError && (
            <div className="grid gap-3">
              {rules?.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-2">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      <Zap className="h-6 w-6" />
                    </div>
                    <p className="font-medium">No automation rules yet</p>
                  </CardContent>
                </Card>
              )}

              {rules?.map((r) => (
                <Card key={r.id} className="shadow-card">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        r.is_active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{r.name || "Untitled rule"}</h4>
                        <Badge
                          variant={r.is_active ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {r.is_active ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {r.rule_type === "time" && <Clock className="h-2.5 w-2.5" />}
                          {ruleTypeLabel(r.rule_type)}
                        </Badge>
                      </div>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-muted">
                          {r.trigger_text || "No trigger set"}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="px-2 py-0.5 rounded bg-muted">
                          {r.action_text || "No action set"}
                        </span>
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
        </TabsContent>

        {/* ---------- LOGS ---------- */}
        <TabsContent value="logs" className="space-y-3 mt-4">
          {logsLoading && (
            <div className="grid gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {logsError && (
            <Card className="border-destructive/40">
              <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Failed to load activity log
              </CardContent>
            </Card>
          )}

          {!logsLoading && !logsError && (
            <div className="grid gap-2">
              {logs?.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    No automation activity yet.
                  </CardContent>
                </Card>
              )}

              {logs?.map((log) => {
                const success = log.result.toLowerCase() === "success";
                return (
                  <Card key={log.id} className="shadow-card">
                    <CardContent className="p-3.5 flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          success
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {success ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {ruleNameById.get(log.rule_id) ?? `Rule #${log.rule_id}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {log.action_taken.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.entity_type} #{log.entity_id} · {timeAgo(log.executed_at)}
                          {log.error_message ? ` · ${log.error_message}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={success ? "default" : "destructive"}
                        className="text-[10px] shrink-0"
                      >
                        {log.result}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

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