import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Plan = "lite" | "prime";

export type PlanFeature = {
  plan: Plan;
  feature_key: string;
  enabled: boolean;
  numeric_limit: number | null;
  description: string | null;
};

export function usePlanFeatures() {
  return useQuery({
    queryKey: ["plan-features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_features")
        .select("plan, feature_key, enabled, numeric_limit, description")
        .order("feature_key");
      if (error) throw error;
      return (data ?? []) as PlanFeature[];
    },
    staleTime: 60_000,
  });
}

export function useHasFeature(plan: Plan | null | undefined, key: string) {
  const { data = [] } = usePlanFeatures();
  if (!plan) return false;
  const row = data.find((f) => f.plan === plan && f.feature_key === key);
  return !!row?.enabled;
}

export function useFeatureLimit(plan: Plan | null | undefined, key: string): number | null {
  const { data = [] } = usePlanFeatures();
  if (!plan) return null;
  const row = data.find((f) => f.plan === plan && f.feature_key === key);
  return row?.numeric_limit ?? null;
}
