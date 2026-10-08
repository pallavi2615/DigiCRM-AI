/**
 * Workspace template library hooks — backend-based.
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { WorkspaceTemplate } from "./workspace-templates";

export interface LibraryRow {
  id: string;
  slug: string;
  definition: WorkspaceTemplate;
  status: "draft" | "published";
  version: number;
  based_on: string | null;
  published_at: string | null;
  updated_at: string | null;
}

/** Ensure a template has every array field initialized. */
export function normalise(t: Partial<WorkspaceTemplate>): WorkspaceTemplate {
  return {
    slug: t.slug ?? "untitled",
    name: t.name ?? "Untitled CRM",
    group: t.group ?? "general",
    positioning: t.positioning ?? "",
    wave: t.wave ?? 1,
    recordLabel: t.recordLabel ?? "Record",
    recordLabelPlural: t.recordLabelPlural ?? "Records",
    partyLabel: t.partyLabel ?? "Customer",
    valueLabel: t.valueLabel ?? "Value",
    stages: t.stages ?? ["New", "Contacted", "Qualified", "Won", "Lost"],
    wonStages: t.wonStages ?? ["Won"],
    lostStages: t.lostStages ?? ["Lost"],
    fields: t.fields ?? [],
    subtypes: t.subtypes ?? [],
    sources: t.sources ?? [],
    modules: t.modules ?? [],
    roles: t.roles ?? [],
    integrations: t.integrations ?? [],
    agents: t.agents ?? [],
    workflows: t.workflows ?? [],
    whatsapp: t.whatsapp ?? [],
    dashboard: t.dashboard ?? [],
    reports: t.reports ?? [],
  };
}

export function useLibraryRows() {
  return useQuery({
    queryKey: ["template-library"],
    queryFn: async (): Promise<LibraryRow[]> => {
      const res = await apiFetch<LibraryRow[]>("/api/v1/workspace-templates").catch(() => []);
      return Array.isArray(res) ? res : [];
    },
    staleTime: 30_000,
  });
}