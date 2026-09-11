/**
 * Pack CMS overrides (client hooks).
 *
 * `src/lib/industry-packs.ts` ships the built-in configuration for every
 * industry pack. Admins can override the terminology, stages, custom fields
 * and AI agent prompts of any pack from /admin-packs — and create entirely
 * new packs there too. Both live in `public.pack_configs`; overrides are
 * merged over the built-in pack, custom rows become packs of their own.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INDUSTRY_PACKS, type IndustryPack } from "./industry-packs";
import { mergePack, packFromRow, resolvePack, type PackOverride } from "./pack-merge";

export { mergePack, packFromRow, resolvePack };
export type { PackOverride };

const COLS =
  "tenant_id, group_slug, pack_slug, record_label, record_label_plural, party_label, value_label, stages, won_stages, lost_stages, fields, agents, name, tagline, description, gradient, kpi_labels, verifications, is_custom, archived_at";

/** Row visibility is enforced by RLS: global rows + rows of my own tenants. */
type Row = PackOverride & { tenant_id?: string | null };

/** A tenant-specific configuration always wins over the global one. */
function preferTenant(rows: Row[]): Row | null {
  return rows.find((r) => r.tenant_id) ?? rows[0] ?? null;
}

async function fetchOverride(group: string, slug: string) {
  const { data, error } = await supabase
    .from("pack_configs")
    .select(COLS)
    .eq("group_slug", group)
    .eq("pack_slug", slug);
  if (error) throw error;
  return preferTenant((data ?? []) as unknown as Row[]);
}

async function fetchAllConfigs() {
  const { data, error } = await supabase.from("pack_configs").select(COLS);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
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
  return mergePack(base, data);
}

export function usePackOverride(group: string, slug: string) {
  return useQuery({
    queryKey: ["pack-config", group, slug],
    queryFn: () => fetchOverride(group, slug),
  });
}

export function usePackConfigs() {
  return useQuery({ queryKey: ["pack-configs"], queryFn: fetchAllConfigs, staleTime: 60_000 });
}

/** Merge built-in packs with admin overrides and any custom packs. */
export function applyConfigs(rows: PackOverride[]): IndustryPack[] {
  const live = rows.filter((r) => !r.archived_at);
  const byKey = new Map(live.map((r) => [`${r.group_slug}::${r.pack_slug}`, r]));
  const builtIn = INDUSTRY_PACKS.map((p) => mergePack(p, byKey.get(`${p.group}::${p.slug}`)));
  const custom = live
    .filter((r) => r.is_custom && !INDUSTRY_PACKS.some((p) => p.group === r.group_slug && p.slug === r.pack_slug))
    .map(packFromRow);
  return [...builtIn, ...custom];
}

/** Every pack available in the app right now (built-in + custom). */
export function useAllPacks(): { packs: IndustryPack[]; isLoading: boolean } {
  const { data = [], isLoading } = usePackConfigs();
  return { packs: applyConfigs(data), isLoading };
}

/** Resolve one pack by key, whether built-in, overridden or fully custom. */
export function usePack(group: string, slug: string): { pack: IndustryPack | undefined; isLoading: boolean } {
  const { data, isLoading } = usePackOverride(group, slug);
  const base = INDUSTRY_PACKS.find((p) => p.group === group && p.slug === slug);
  return { pack: resolvePack(base, data), isLoading };
}

/**
 * The pack this workspace actually runs, taken from its own pack_configs row.
 * Falls back to null while loading or when the workspace has no pack of its own.
 */
export function useTenantPackKey(tenantId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["tenant-pack-key", tenantId],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_configs")
        .select("group_slug, pack_slug, created_at")
        .eq("tenant_id", tenantId!)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      return row ? `${row.group_slug}::${row.pack_slug}` : null;
    },
  });
  return data ?? null;
}
