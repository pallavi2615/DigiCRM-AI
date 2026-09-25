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

export const ALL_CRMS = "all";

type IndustrySlug = IndustryGroup["slug"];

let activeIndustry: string = ALL_CRMS;

const listeners = new Set<() => void>();

function subscribe(
  listener: () => void,
) {
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

function updateActiveIndustry(
  slug: string,
) {
  if (activeIndustry === slug) {
    return;
  }

  activeIndustry = slug;

  listeners.forEach((listener) => {
    listener();
  });
}

export function setActiveIndustry(
  slug: string,
) {
  updateActiveIndustry(slug);
}

export function getActiveIndustry() {
  return activeIndustry;
}

export function useActiveIndustry() {
  const access = useIndustryAccess();

  const active = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const allowed = useMemo(() => {
    if (access.unrestricted) {
      return INDUSTRY_GROUPS.map(
        (group) => ({
          slug: group.slug,
          name: group.name,
        }),
      );
    }

    return INDUSTRY_GROUPS
      .filter((group) =>
        access.groups.includes(
          group.slug,
        ),
      )
      .map((group) => ({
        slug: group.slug,
        name: group.name,
      }));
  }, [
    access.unrestricted,
    access.groups,
  ]);

  const validActive =
    active === ALL_CRMS ||
    allowed.some(
      (item) => item.slug === active,
    );

  const actualActive = validActive
    ? active
    : ALL_CRMS;

  const activeGroup =
    actualActive === ALL_CRMS
      ? null
      : INDUSTRY_GROUPS.find(
          (group) =>
            group.slug === actualActive,
        )?.slug ?? null;

  const activeName =
    actualActive === ALL_CRMS
      ? "All industries"
      : INDUSTRY_GROUPS.find(
          (group) =>
            group.slug === actualActive,
        )?.name ?? "All industries";

  const setActive = useCallback(
    (slug: string) => {
      if (slug === ALL_CRMS) {
        updateActiveIndustry(
          ALL_CRMS,
        );
        return;
      }

      const exists = allowed.some(
        (item) =>
          item.slug === slug,
      );

      if (!exists) {
        return;
      }

      updateActiveIndustry(slug);
    },
    [allowed],
  );

  return {
    active: actualActive,
    activeGroup,
    activeName,
    allowed,
    canSwitch: allowed.length > 1,
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
    routes: [
      "/industry/healthcare-clinics",
    ],
    group: "healthcare",
  },
  {
    routes: [
      "/industry/education",
    ],
    group: "education",
  },
  {
    routes: [
      "/industry/insurance",
    ],
    group: "financial-services",
  },
  {
    routes: [
      "/industry/automotive",
    ],
    group: "mobility-supply-chain",
  },
  {
    routes: [
      "/industry/travel",
    ],
    group: "mobility-supply-chain",
  },
  {
    routes: [
      "/industry/manufacturing",
    ],
    group: "industrial",
  },
];

export function groupForRoute(
  route: string,
): IndustrySlug | null {
  const match = ROUTE_GROUPS.find(
    (item) =>
      item.routes.some(
        (candidate) =>
          route === candidate ||
          route.startsWith(
            `${candidate}/`,
          ),
      ),
  );

  return match?.group ?? null;
}

export function scopeToIndustry<
  T extends {
    eq: (
      column: string,
      value: string,
    ) => T;
  },
>(
  query: T,
  group: IndustrySlug | null,
): T {
  if (!group) {
    return query;
  }

  return query.eq(
    "industry_group",
    group,
  );
}