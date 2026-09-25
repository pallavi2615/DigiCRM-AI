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

const ALL_INDUSTRY_SLUGS = INDUSTRY_GROUPS.map((g) => g.slug);

export function useIndustryAccess(): IndustryAccess {
  return {
    loading: false,
    unrestricted: true,
    groups: ALL_INDUSTRY_SLUGS,
    canUse: () => true,
    canUseRoute: () => true,
  };
}

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