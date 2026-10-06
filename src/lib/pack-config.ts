/**
 * Pack CMS overrides (client hooks).
 * Backend-based — Supabase replaced with FastAPI.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { INDUSTRY_PACKS, type IndustryPack } from "./industry-packs";
import { mergePack, packFromRow, resolvePack, type PackOverride } from "./pack-merge";

export { mergePack, packFromRow, resolvePack };
export type { PackOverride };

type Row = PackOverride & { tenant_id?: number | null };

/** A tenant-specific configuration always wins over the global one. */
function preferTenant(rows: Row[]): Row | null {
  return rows.find((r) => r.tenant_id) ?? rows[0] ?? null;
}

/** Fetch a single pack override (group + slug). */
async function fetchOverride(group: string, slug: string): Promise<PackOverride | null> {
  const res = await apiFetch<Row[]>(
    `/api/v1/packs/configs/${group}/${slug}`
  ).catch(() => []);
  const rows = Array.isArray(res) ? res : [];
  return preferTenant(rows);
}

/** Fetch all pack configs. */
async function fetchAllConfigs(): Promise<PackOverride[]> {
  const res = await apiFetch<Row[]>("/api/v1/packs/configs").catch(() => []);
  const rows = Array.isArray(res) ? res : [];
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.group_slug}::${r.pack_slug}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  return [...byKey.values()].map((list) => preferTenant(list)!) as PackOverride[];
}

/** The pack as configured today: built-in defaults plus any admin overrides. */
export function usePackConfig(base: IndustryPack): IndustryPack {
  const { data } = useQuery({
    queryKey: ["pack-config", base.group, base.slug],
    queryFn: () => fetchOverride(base.group, base.slug),
    staleTime: 60_000,
  });
  return mergePack(base, data ?? undefined);
}

export function usePackOverride(group: string, slug: string) {
  return useQuery({
    queryKey: ["pack-config", group, slug],
    queryFn: () => fetchOverride(group, slug),
  });
}

export function usePackConfigs() {
  return useQuery({
    queryKey: ["pack-configs"],
    queryFn: fetchAllConfigs,
    staleTime: 60_000,
  });
}

/** Merge built-in packs with admin overrides and any custom packs. */
export function applyConfigs(rows: PackOverride[]): IndustryPack[] {
  const live = rows.filter((r) => !r.archived_at);
  const byKey = new Map(live.map((r) => [`${r.group_slug}::${r.pack_slug}`, r]));
  const builtIn = INDUSTRY_PACKS.map((p) => mergePack(p, byKey.get(`${p.group}::${p.slug}`)));
  const custom = live
    .filter(
      (r) =>
        r.is_custom &&
        !INDUSTRY_PACKS.some((p) => p.group === r.group_slug && p.slug === r.pack_slug)
    )
    .map(packFromRow);
  return [...builtIn, ...custom];
}

/** Every pack available in the app right now (built-in + custom). */
export function useAllPacks(): { packs: IndustryPack[]; isLoading: boolean } {
  const { data = [], isLoading } = usePackConfigs();
  return { packs: applyConfigs(data), isLoading };
}

/** Resolve one pack by key, whether built-in, overridden or fully custom. */
export function usePack(
  group: string,
  slug: string
): { pack: IndustryPack | undefined; isLoading: boolean } {
  const { data, isLoading } = usePackOverride(group, slug);
  const base = INDUSTRY_PACKS.find((p) => p.group === group && p.slug === slug);
  return { pack: resolvePack(base, data ?? undefined), isLoading };
}

/**
 * The pack this workspace actually runs, taken from its own pack_configs row.
 */
export function useTenantPackKey(tenantId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["tenant-pack-key", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await apiFetch<{ key: string | null }>(
        `/api/v1/packs/tenant-pack-key?tenant_id=${tenantId}`
      ).catch(() => ({ key: null }));
      return res?.key ?? null;
    },
  });
  return data ?? null;
}