import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";

/** The industry groups a person can be granted access to. */
export const ACCESS_GROUPS = INDUSTRY_GROUPS.map((g) => ({ slug: g.slug, name: g.name }));

/** Maps an in-app industry workspace route to the industry group that owns it. */
export const ROUTE_GROUP: Record<string, string> = {
  "/fintech": "financial-services",
  "/realestate": "property",
  "/it": "professional-services",
  "/productsales": "commerce",
  "/industry/healthcare-clinics": "healthcare",
  "/industry/education": "education",
  "/industry/insurance": "financial-services",
  "/industry/automotive": "mobility-supply-chain",
  "/industry/travel": "mobility-supply-chain",
  "/industry/manufacturing": "industrial",
};

export function groupForRoute(route: string): string | undefined {
  return ROUTE_GROUP[route];
}

export interface IndustryAccess {
  loading: boolean;
  /** true when the person is not restricted to specific industries. */
  unrestricted: boolean;
  groups: string[];
  canUse: (group?: string | null) => boolean;
  canUseRoute: (route: string) => boolean;
}

/**
 * Which industry CRMs the signed-in person may open. Admins and Super Admins
 * are unrestricted; anyone with no assignment keeps full access so existing
 * accounts are never locked out. Database policies enforce the same rule.
 */
export function useIndustryAccess(): IndustryAccess {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["industry-access", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("user_industry_access")
        .select("industry_group")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (rows ?? []).map((r) => r.industry_group as string);
    },
  });

  const groups = data ?? [];
  const unrestricted = isAdmin || groups.length === 0;

  const canUse = (group?: string | null) => unrestricted || !group || groups.includes(group);

  return {
    loading: authLoading || (!!user?.id && isLoading),
    unrestricted,
    groups,
    canUse,
    canUseRoute: (route: string) => canUse(groupForRoute(route)),
  };
}

/** Reads and writes industry assignments for another user (admins only, enforced by policy). */
export async function fetchUserIndustries(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_industry_access")
    .select("industry_group")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.industry_group as string);
}

export async function setUserIndustries(userId: string, groups: string[]) {
  const { error: delErr } = await supabase
    .from("user_industry_access")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw delErr;
  if (groups.length === 0) return;
  const { error } = await supabase
    .from("user_industry_access")
    .insert(groups.map((g) => ({ user_id: userId, industry_group: g })));
  if (error) throw error;
}

/**
 * A partner or client picking their own industry when they join. The database
 * only allows this once — after that an administrator changes it for them.
 */
export async function claimIndustry(userId: string, group: string) {
  const { error } = await supabase
    .from("user_industry_access")
    .insert({ user_id: userId, industry_group: group });
  if (error) throw error;
}
