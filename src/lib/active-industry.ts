import { useSyncExternalStore, useCallback } from "react";
import { useIndustryAccess } from "@/lib/industry-access";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";

/**
 * The "active CRM" — which industry workspace the person is currently working
 * inside. Everything they see (menu, leads, pipeline, tasks, tickets, reports)
 * is narrowed to this industry. The list of industries a person may choose from
 * comes from their account's industry assignments, which the database policies
 * enforce independently of anything the browser does.
 */

export const ALL_CRMS = "all";
const KEY = "digicrm.active_crm";

let current: string = typeof window === "undefined" ? ALL_CRMS : localStorage.getItem(KEY) || ALL_CRMS;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function getSnapshot() {
  return current;
}
function getServerSnapshot() {
  return ALL_CRMS;
}

export function setActiveIndustry(slug: string) {
  current = slug;
  if (typeof window !== "undefined") localStorage.setItem(KEY, slug);
  listeners.forEach((fn) => fn());
}

export interface ActiveIndustry {
  loading: boolean;
  /** Industries this person may open. */
  allowed: Array<{ slug: string; name: string }>;
  /** Selected industry slug, or "all" when the person works across industries. */
  active: string;
  /** The industry to filter records by, or null when nothing is narrowed. */
  group: string | null;
  /** Display name of the active industry. */
  activeName: string;
  setActive: (slug: string) => void;
  /** True when the person has more than one industry to choose from. */
  canSwitch: boolean;
}

export function useActiveIndustry(): ActiveIndustry {
  const access = useIndustryAccess();
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const allowed = access.unrestricted
    ? INDUSTRY_GROUPS.map((g) => ({ slug: g.slug, name: g.name }))
    : INDUSTRY_GROUPS.filter((g) => access.groups.includes(g.slug)).map((g) => ({ slug: g.slug, name: g.name }));

  // Someone assigned to exactly one industry is always locked into it.
  const locked = !access.unrestricted && allowed.length === 1 ? allowed[0]!.slug : null;
  const valid = stored === ALL_CRMS || allowed.some((g) => g.slug === stored);
  const active = locked ?? (valid ? stored : ALL_CRMS);

  const setActive = useCallback((slug: string) => {
    setActiveIndustry(slug);
  }, []);

  return {
    loading: access.loading,
    allowed,
    active,
    group: active === ALL_CRMS ? null : active,
    activeName: allowed.find((g) => g.slug === active)?.name ?? "All industries",
    setActive,
    canSwitch: !locked && allowed.length > 1,
  };
}

/** Narrows a Supabase query to one industry. */
export function scopeToIndustry<T extends { eq: (c: string, v: string) => T }>(query: T, group: string | null): T {
  return group ? query.eq("industry_group", group) : query;
}
