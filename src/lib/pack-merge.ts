/**
 * Pure merge helpers for pack CMS overrides (safe to import on the server).
 *
 * A `pack_configs` row is either an *override* of a built-in pack, or — when
 * `is_custom` is true — a complete pack authored from the pack builder with
 * no built-in base at all.
 */

import type { IndustryPack, PackAgent, PackField, VerificationKind } from "./industry-packs";
import { INDUSTRY_GROUPS } from "./industry-taxonomy";

export type PackOverride = {
  group_slug: string;
  pack_slug: string;
  record_label: string | null;
  record_label_plural: string | null;
  party_label: string | null;
  value_label: string | null;
  stages: string[] | null;
  won_stages: string[] | null;
  lost_stages?: string[] | null;
  fields: PackField[] | null;
  agents: PackAgent[] | null;
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
  gradient?: string | null;
  kpi_labels?: string[] | null;
  verifications?: VerificationKind[] | null;
  is_custom?: boolean | null;
  archived_at?: string | null;
};

const arr = <T,>(v: unknown): T[] | null => (Array.isArray(v) && v.length > 0 ? (v as T[]) : null);

/** Merge a `pack_configs` row over the built-in pack. */
export function mergePack(base: IndustryPack, row?: Partial<PackOverride> | null): IndustryPack {
  if (!row) return base;
  const stages = arr<string>(row.stages) ?? base.stages;
  const wonStages = (arr<string>(row.won_stages) ?? base.wonStages).filter((s) => stages.includes(s));
  return {
    ...base,
    name: row.name || base.name,
    tagline: row.tagline || base.tagline,
    recordLabel: row.record_label || base.recordLabel,
    recordLabelPlural: row.record_label_plural || base.recordLabelPlural,
    partyLabel: row.party_label || base.partyLabel,
    valueLabel: row.value_label || base.valueLabel,
    stages,
    wonStages: wonStages.length > 0 ? wonStages : [stages[stages.length - 1]!],
    lostStages: (arr<string>(row.lost_stages) ?? base.lostStages).filter((s) => stages.includes(s)),
    fields: arr<PackField>(row.fields) ?? base.fields,
    agents: arr<PackAgent>(row.agents) ?? base.agents,
    kpiLabels: arr<string>(row.kpi_labels) ?? base.kpiLabels,
    verifications: arr<VerificationKind>(row.verifications) ?? base.verifications,
  };
}

/** Build a full pack from a custom `pack_configs` row (no built-in base). */
export function packFromRow(row: Partial<PackOverride>): IndustryPack {
  const group = INDUSTRY_GROUPS.find((g) => g.slug === row.group_slug);
  const stages = arr<string>(row.stages) ?? ["New", "In progress", "Won"];
  const won = (arr<string>(row.won_stages) ?? []).filter((s) => stages.includes(s));
  return {
    group: row.group_slug ?? "professional-services",
    groupName: group?.name ?? "Custom",
    groupGradient: row.gradient || group?.gradient || "linear-gradient(135deg,#6366f1,#8b5cf6)",
    slug: row.pack_slug ?? "custom",
    name: row.name || row.pack_slug || "Custom pack",
    tagline: row.tagline || "Custom industry pack.",
    recordLabel: row.record_label || "Deal",
    recordLabelPlural: row.record_label_plural || "Deals",
    partyLabel: row.party_label || "Customer",
    valueLabel: row.value_label || "Deal value",
    stages,
    wonStages: won.length > 0 ? won : [stages[stages.length - 1]!],
    lostStages: (arr<string>(row.lost_stages) ?? []).filter((s) => stages.includes(s)),
    fields: arr<PackField>(row.fields) ?? [],
    agents: arr<PackAgent>(row.agents) ?? [],
    kpiLabels: arr<string>(row.kpi_labels) ?? ["Total", "Conversion", "Pipeline value"],
    verifications: arr<VerificationKind>(row.verifications) ?? [],
    objects: [],
  };
}

/** Resolve a row against the built-in registry: override or full custom pack. */
export function resolvePack(base: IndustryPack | undefined, row?: Partial<PackOverride> | null): IndustryPack | undefined {
  if (base) return mergePack(base, row);
  if (row && row.is_custom) return packFromRow(row);
  return undefined;
}
