import {
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  INDUSTRY_GROUPS,
  type IndustryGroup,
} from "@/lib/industry-taxonomy";

import { useIndustryAccess } from "@/lib/industry-access";
import { useAuth } from "@/hooks/use-auth";

export const ALL_CRMS = "all";

// NOTE: deliberately NOT "active_industry" — auth.tsx already uses that key
// for backend industry keys (e.g. "real_estate"), while this store works with
// taxonomy group slugs (e.g. "property"). Sharing a key would corrupt both.
const STORAGE_KEY = "active_crm_group";

type IndustrySlug = IndustryGroup["slug"];

const isSuperAdminRole = (r: unknown) => {
  const v = String(r ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return v === "super_admin" || v === "superadmin";
};

/* ------------------------------------------------------------------ */
/* Persistence — survives a page refresh                               */
/* ------------------------------------------------------------------ */

function readStored(): string {
  if (typeof window === "undefined") return ALL_CRMS;
  try {
    return localStorage.getItem(STORAGE_KEY) || ALL_CRMS;
  } catch {
    return ALL_CRMS;
  }
}

function writeStored(slug: string) {
  if (typeof window === "undefined") return;
  try {
    if (slug === ALL_CRMS) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    /* storage unavailable — keep in-memory value only */
  }
}

let activeIndustry: string = readStored();

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return activeIndustry;
}

function getServerSnapshot() {
  return ALL_CRMS;
}

function updateActiveIndustry(slug: string) {
  if (activeIndustry === slug) {
    return;
  }

  activeIndustry = slug;
  writeStored(slug);

  listeners.forEach((listener) => {
    listener();
  });
}

export function setActiveIndustry(slug: string) {
  updateActiveIndustry(slug);
}

export function getActiveIndustry() {
  return activeIndustry;
}

/** Call on sign out so the next user starts clean. */
export function resetActiveIndustry() {
  updateActiveIndustry(ALL_CRMS);
}

export function useActiveIndustry() {
  const access = useIndustryAccess();
  const { roles } = useAuth();

  const isSuperAdmin = roles.some(isSuperAdminRole);

  const stored = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const allowed = useMemo(() => {
    if (access.unrestricted) {
      return INDUSTRY_GROUPS.map((group) => ({
        slug: group.slug,
        name: group.name,
      }));
    }

    return INDUSTRY_GROUPS
      .filter((group) => access.groups.includes(group.slug))
      .map((group) => ({
        slug: group.slug,
        name: group.name,
      }));
  }, [access.unrestricted, access.groups]);

  let actualActive: string;

  if (access.loading) {
    // Don't flash "All industries" (or drop the saved choice) while
    // access data is still loading after a refresh.
    actualActive = stored;
  } else if (!isSuperAdmin) {
    // Non-super-admins can never pick a CRM: they are locked to their
    // single allowed industry (or see "all of theirs" if they have several).
    actualActive = allowed.length === 1 ? allowed[0].slug : ALL_CRMS;
  } else {
    const validActive =
      stored === ALL_CRMS || allowed.some((item) => item.slug === stored);
    actualActive = validActive ? stored : ALL_CRMS;
  }

  const activeGroup =
    actualActive === ALL_CRMS
      ? null
      : INDUSTRY_GROUPS.find((group) => group.slug === actualActive)?.slug ?? null;

  const activeName =
    actualActive === ALL_CRMS
      ? "All industries"
      : INDUSTRY_GROUPS.find((group) => group.slug === actualActive)?.name ??
        "All industries";

  const setActive = useCallback(
    (slug: string) => {
      // Only the SuperAdmin may change the active CRM.
      if (!isSuperAdmin) {
        return;
      }

      if (slug === ALL_CRMS) {
        updateActiveIndustry(ALL_CRMS);
        return;
      }

      const exists = allowed.some((item) => item.slug === slug);

      if (!exists) {
        return;
      }

      updateActiveIndustry(slug);
    },
    [allowed, isSuperAdmin],
  );

  return {
    active: actualActive,
    activeGroup,
    activeName,
    allowed,
    canSwitch: isSuperAdmin && allowed.length > 1,
    isSuperAdmin,
    loading: access.loading,
    setActive,
  };
}

const ROUTE_GROUPS: Array<{
  routes: string[];
  group: IndustrySlug;
}> = [
  {
    routes: ["/fintech"],
    group: "financial-services",
  },
  {
    routes: ["/realestate"],
    group: "property",
  },
  {
    routes: ["/it"],
    group: "professional-services",
  },
  {
    routes: ["/productsales"],
    group: "commerce",
  },
  {
    routes: ["/industry/healthcare-clinics"],
    group: "healthcare",
  },
  {
    routes: ["/industry/education"],
    group: "education",
  },
  {
    routes: ["/industry/insurance"],
    group: "financial-services",
  },
  {
    routes: ["/industry/automotive"],
    group: "mobility-supply-chain",
  },
  {
    routes: ["/industry/travel"],
    group: "mobility-supply-chain",
  },
  {
    routes: ["/industry/manufacturing"],
    group: "industrial",
  },
];

export function groupForRoute(route: string): IndustrySlug | null {
  const match = ROUTE_GROUPS.find((item) =>
    item.routes.some(
      (candidate) =>
        route === candidate || route.startsWith(`${candidate}/`),
    ),
  );

  return match?.group ?? null;
}

export function scopeToIndustry<
  T extends {
    eq: (column: string, value: string) => T;
  },
>(query: T, group: IndustrySlug | null): T {
  if (!group) {
    return query;
  }

  return query.eq("industry_group", group);
}