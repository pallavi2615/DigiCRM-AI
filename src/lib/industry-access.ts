import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";

/** The industry groups a person can be granted access to. */
export const ACCESS_GROUPS = INDUSTRY_GROUPS.map((g) => ({ slug: g.slug, name: g.name }));

/** Maps an in-app industry workspace route to the industry group that owns it. */
export const ROUTE_GROUP: Record<string, string> = {
  "/fintech": "financial-services",
  "/realestate": "property",
  "/it": "professional-services",
  "/coaching": "education", // ⚠ adjust if coaching belongs to another taxonomy group
  "/productsales": "commerce",
  "/industry/healthcare-clinics": "healthcare",
  "/industry/education": "education",
  "/industry/insurance": "financial-services",
  "/industry/automotive": "mobility-supply-chain",
  "/industry/travel": "mobility-supply-chain",
  "/industry/manufacturing": "industrial",
};

/**
 * CRM route -> industry key returned by the backend in
 * GET /auth/my-permissions (`industries`, resolved from the user's tenant_id).
 *
 * Confirmed from auth.tsx: it_company, real_estate, coaching.
 * ⚠ The rest are best guesses — match them with `Industry.key` in your DB.
 */
export const INDUSTRY_KEY_BY_ROUTE: Record<string, string> = {
  "/it": "it_company",
  "/realestate": "real_estate",
  "/coaching": "coaching",
  "/fintech": "fintech",
  "/productsales": "product_sales",
  "/industry/healthcare-clinics": "healthcare",
  "/industry/education": "education",
  "/industry/insurance": "insurance",
  "/industry/automotive": "automotive",
  "/industry/travel": "travel",
  "/industry/manufacturing": "manufacturing",
};

export function groupForRoute(route: string): string | undefined {
  return ROUTE_GROUP[route];
}

/** true for real industry CRM routes (as opposed to generic tools like /packs). */
export function isCrmRoute(route: string): boolean {
  return route in INDUSTRY_KEY_BY_ROUTE;
}

export interface IndustryAccess {
  loading: boolean;
  /** true only for the SuperAdmin (not restricted to a tenant's industries). */
  unrestricted: boolean;
  groups: string[];
  canUse: (group?: string | null) => boolean;
  canUseRoute: (route: string) => boolean;
}

const ALL_INDUSTRY_SLUGS = INDUSTRY_GROUPS.map((g) => g.slug);

/* ------------------------------------------------------------------ */
/* Tenant industries — GET /api/v1/auth/my-permissions                 */
/* ------------------------------------------------------------------ */

type MyPermissions = {
  role: string;
  is_super_admin: boolean;
  industries: string[]; // industries subscribed by the user's tenant_id
};

function cachedPermissions(): MyPermissions | undefined {
  try {
    const raw = localStorage.getItem("permissions");
    return raw ? (JSON.parse(raw) as MyPermissions) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Access is decided by the logged-in user's tenant:
 *  - SuperAdmin: unrestricted, sees every industry.
 *  - Everyone else (admin / manager / executive): only the industries
 *    their tenant_id is subscribed to.
 */
export function useIndustryAccess(): IndustryAccess {
  const { roles } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const p = await apiFetch<MyPermissions>("/api/v1/auth/my-permissions");
      try {
        localStorage.setItem("permissions", JSON.stringify(p));
      } catch {
        /* ignore */
      }
      return p;
    },
    staleTime: 5 * 60_000,
    // show the cached value instantly on refresh, then re-fetch in background
    initialData: cachedPermissions,
    initialDataUpdatedAt: 0,
  });

  const isSuperAdmin = roles.includes("super_admin") || data?.is_super_admin === true;
  const keys = data?.industries ?? [];

  return useMemo<IndustryAccess>(() => {
    if (isSuperAdmin) {
      return {
        loading: false,
        unrestricted: true,
        groups: ALL_INDUSTRY_SLUGS,
        canUse: () => true,
        canUseRoute: () => true,
      };
    }

    const allowedRoutes = new Set(
      Object.entries(INDUSTRY_KEY_BY_ROUTE)
        .filter(([, key]) => keys.includes(key))
        .map(([route]) => route),
    );

    const groups = Array.from(
      new Set(
        [...allowedRoutes]
          .map((route) => ROUTE_GROUP[route])
          .filter((g): g is string => !!g),
      ),
    );

    return {
      loading: isLoading && !data,
      unrestricted: false,
      groups,
      canUse: (group) => !!group && groups.includes(group),
      // CRM routes need a matching tenant industry; generic routes stay open
      canUseRoute: (route) => (isCrmRoute(route) ? allowedRoutes.has(route) : true),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, keys.join("|"), isLoading, !!data]);
}

/* ------------------------------------------------------------------ */
/* Per-user industry helpers (kept as-is; no backend route exists)     */
/* ------------------------------------------------------------------ */

export async function fetchUserIndustries(_userId: string): Promise<string[]> {
  return ALL_INDUSTRY_SLUGS;
}

export async function setUserIndustries(_userId: string, groups: string[]): Promise<string[]> {
  return groups.filter((slug) => ALL_INDUSTRY_SLUGS.includes(slug));
}

export async function claimIndustry(_userId: string, group: string): Promise<string[]> {
  if (!ALL_INDUSTRY_SLUGS.includes(group)) {
    throw new Error("Invalid industry");
  }
  return [group];
}