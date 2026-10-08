/**
 * Built-in workspace templates.
 * Maps INDUSTRY_PACKS into the WorkspaceTemplate shape used by the admin builder.
 */

import { INDUSTRY_PACKS } from "@/lib/industry-packs";

export interface TemplateField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  options?: string[];
}

export interface TemplateAgent {
  key: string;
  label: string;
  description: string;
  instruction: string;
}

export interface WorkspaceTemplate {
  slug: string;
  name: string;
  group: string;
  positioning: string;
  wave: 1 | 2;
  recordLabel: string;
  recordLabelPlural: string;
  partyLabel: string;
  valueLabel: string;
  stages: string[];
  wonStages: string[];
  lostStages: string[];
  fields: TemplateField[];
  subtypes: string[];
  sources: string[];
  modules: string[];
  roles: string[];
  integrations: string[];
  agents: TemplateAgent[];
  workflows: any[];
  whatsapp: any[];
  dashboard: any[];
  reports: any[];
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = INDUSTRY_PACKS.map((p) => ({
  slug: p.slug,
  name: p.name,
  group: p.group,
  positioning: p.tagline ?? "",
  wave: 1 as const,
  recordLabel: p.recordLabel ?? "Record",
  recordLabelPlural: p.recordLabelPlural ?? "Records",
  partyLabel: p.partyLabel ?? "Customer",
  valueLabel: p.valueLabel ?? "Value",
  stages: p.stages ?? ["New", "Contacted", "Qualified", "Won", "Lost"],
  wonStages: p.wonStages ?? ["Won"],
  lostStages: p.lostStages ?? ["Lost"],
  fields: (p.fields ?? []).map((f: any) => ({
    key: f.key,
    label: f.label,
    type: f.type ?? "text",
    options: f.options ?? [],
  })),
  subtypes: [],
  sources: [],
  modules: [],
  roles: [],
  integrations: [],
  agents: (p.agents ?? []).map((a: any, i: number) => ({
    key: a.key ?? `agent_${i}`,
    label: a.label ?? a.name ?? "Agent",
    description: a.description ?? "",
    instruction: a.instruction ?? a.prompt ?? "",
  })),
  workflows: [],
  whatsapp: [],
  dashboard: [],
  reports: [],
}));