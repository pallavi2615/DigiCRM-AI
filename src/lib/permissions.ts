import type { AppRole } from "@/hooks/use-auth";

export type Action = "view" | "create" | "edit" | "delete";

export interface ModuleDef {
  key: string;
  label: string;
  panel: string;
  route?: string;
  description: string;
  perms: Record<AppRole, Action[]>;
}

export const ROLES: { key: AppRole; label: string; blurb: string }[] = [
  { key: "super_admin", label: "Super Admin", blurb: "Owns the platform: every module, plans, CMS and destructive actions." },
  { key: "admin", label: "Admin", blurb: "Runs the workspace: all CRM data, tenants, webhooks, audit and analytics." },
  { key: "sales_manager", label: "Sales Manager", blurb: "Leads the sales team: full CRM operations, reporting, no platform administration." },
  { key: "sales_executive", label: "Sales Executive", blurb: "Works their own pipeline: create and update records, no deletions or admin tooling." },
];

const ALL: Action[] = ["view", "create", "edit", "delete"];
const CRUD_NO_DELETE: Action[] = ["view", "create", "edit"];
const VIEW: Action[] = ["view"];
const NONE: Action[] = [];

const p = (
  superAdmin: Action[], admin: Action[], manager: Action[], exec: Action[],
): Record<AppRole, Action[]> => ({
  super_admin: superAdmin, admin, sales_manager: manager, sales_executive: exec,
});

export const MODULES: ModuleDef[] = [
  // Workspace
  { key: "dashboard", label: "Dashboard", panel: "Workspace", route: "/dashboard", description: "KPI cards, revenue and pipeline charts, customisable widget layout.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "leads", label: "Leads", panel: "Workspace", route: "/leads", description: "Lead records with CSV import/export, search, status and owner assignment.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "contacts", label: "Contacts", panel: "Workspace", route: "/contacts", description: "People linked to companies, with import/export and attachments.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "companies", label: "Companies", panel: "Workspace", route: "/companies", description: "Accounts with industry, revenue, GST and address details.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "pipeline", label: "Pipeline", panel: "Workspace", route: "/pipeline", description: "Kanban deal board with drag-and-drop stage changes and deal details.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "tasks", label: "Tasks", panel: "Workspace", route: "/tasks", description: "Assignable to-dos with priority, due dates and reminders.", perms: p(ALL, ALL, ALL, CRUD_NO_DELETE) },
  { key: "calendar", label: "Calendar", panel: "Workspace", route: "/calendar", description: "Month view combining meetings and task deadlines.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "meetings", label: "Meetings", panel: "Workspace", route: "/meetings", description: "Scheduled calls with location, join link, participants and outcome notes.", perms: p(ALL, ALL, ALL, CRUD_NO_DELETE) },

  // Support
  { key: "tickets", label: "Tickets", panel: "Support", route: "/tickets", description: "Freshdesk-style helpdesk with SLA timers, replies and macros.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "inbound", label: "Inbound Leads", panel: "Support", route: "/inbound", description: "Webhook, Google Sheet and Facebook lead intake log.", perms: p(ALL, ALL, VIEW, NONE) },
  { key: "webhook-dead-letter", label: "Webhook Retries", panel: "Support", route: "/webhook-dead-letter", description: "Dead-letter queue with per-event HMAC, dedupe and retry timeline.", perms: p(ALL, ALL, NONE, NONE) },
  { key: "webhook-settings", label: "Webhook Settings", panel: "Support", route: "/webhook-settings", description: "Per-tenant retry attempts, backoff factor and signing secret.", perms: p(ALL, ALL, NONE, NONE) },

  // Industry CRMs
  { key: "fintech", label: "Fintech / DSA CRM", panel: "Industry CRMs", route: "/fintech", description: "Loan applications, lenders, products, disbursals and commissions.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "lenders", label: "Lenders & Loan Products", panel: "Industry CRMs", route: "/fintech/lenders", description: "Staff-only catalogue including payout percentages.", perms: p(ALL, ALL, VIEW, NONE) },
  { key: "realestate", label: "Real Estate CRM", panel: "Industry CRMs", route: "/realestate", description: "Properties, buyer clients, site visits and deal stages.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "it", label: "IT Services CRM", panel: "Industry CRMs", route: "/it", description: "Projects, delivery pipeline and engineering tickets.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "productsales", label: "Product Sales CRM", panel: "Industry CRMs", route: "/productsales", description: "Catalogue, orders and sales commissions.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "products", label: "Product Catalogue (cost data)", panel: "Industry CRMs", route: "/productsales/products", description: "Staff-only catalogue including cost price and margins.", perms: p(ALL, ALL, VIEW, NONE) },
  { key: "industry", label: "Industry Workspaces", panel: "Industry CRMs", route: "/industry/healthcare-clinics", description: "Healthcare, Education, Insurance, Automotive, Travel and Manufacturing workspaces.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },

  // Insights
  { key: "reports", label: "Reports", panel: "Insights", route: "/reports", description: "Revenue trends, source mix, industry split and conversion metrics.", perms: p(ALL, ALL, VIEW, VIEW) },
  { key: "ai", label: "AI Assistant", panel: "Insights", route: "/ai", description: "Grounded sales assistant over records the signed-in user may read.", perms: p(ALL, ALL, CRUD_NO_DELETE, CRUD_NO_DELETE) },
  { key: "proposals", label: "Proposals", panel: "Insights", route: "/proposals", description: "Proposal records with stage, value, probability, owner, close date and AI-drafted documents.", perms: p(ALL, ALL, ALL, CRUD_NO_DELETE) },
  { key: "automation", label: "Automation", panel: "Insights", route: "/automation", description: "Trigger/condition/action rules for lead and ticket workflows.", perms: p(ALL, ALL, CRUD_NO_DELETE, NONE) },

  // Administration
  { key: "audit-logs", label: "Audit Logs", panel: "Administration", route: "/audit-logs", description: "Field-level change history and access-denial records.", perms: p(ALL, ALL, NONE, NONE) },
  { key: "landing-analytics", label: "Landing Analytics", panel: "Administration", route: "/landing-analytics", description: "Traffic, source and session analytics for public landing pages.", perms: p(ALL, ALL, NONE, NONE) },
  { key: "landing-conversions", label: "Conversions", panel: "Administration", route: "/landing-conversions", description: "View → submit → qualified funnel with CSV exports.", perms: p(ALL, ALL, NONE, NONE) },
  { key: "affiliates", label: "Affiliates", panel: "Administration", route: "/affiliates", description: "Partner approvals, referral codes and commission tracking.", perms: p(ALL, ALL, NONE, NONE) },
  { key: "settings-tenants", label: "Tenants & White Label", panel: "Administration", route: "/settings-tenants", description: "Tenant branding, custom domains, plans and generated landing pages.", perms: p(ALL, ALL, NONE, NONE) },
  { key: "user-roles", label: "User Roles", panel: "Administration", route: "/settings", description: "Assign workspace roles. Admins may only manage junior roles.", perms: p(ALL, ["view", "edit"], NONE, NONE) },

  // Platform
  { key: "settings-plans", label: "Plans & Features (Lite/Prime)", panel: "Platform", route: "/settings-plans", description: "Define which features each plan unlocks across all tenants.", perms: p(ALL, NONE, NONE, NONE) },
  { key: "settings-cms", label: "Content (CMS) & SEO", panel: "Platform", route: "/settings-cms", description: "Pages, blog posts, menus, campaigns, home slides and SEO defaults.", perms: p(ALL, NONE, NONE, NONE) },
  { key: "feature-matrix", label: "Feature Matrix", panel: "Platform", route: "/feature-matrix", description: "This page: panel-wise modules and role-wise permission table.", perms: p(VIEW, VIEW, VIEW, VIEW) },

  // Personal
  { key: "notifications", label: "Notifications", panel: "Personal", route: "/notifications", description: "In-app alerts for assignments, SLA breaches and inbound leads.", perms: p(ALL, ALL, ["view", "edit"], ["view", "edit"]) },
  { key: "settings", label: "My Settings", panel: "Personal", route: "/settings", description: "Profile, timezone, theme and workspace preferences.", perms: p(ALL, ALL, ["view", "edit"], ["view", "edit"]) },
];

export const PANELS = [...new Set(MODULES.map((m) => m.panel))];

export function moduleFor(key: string): ModuleDef | undefined {
  return MODULES.find((m) => m.key === key);
}

/** Whether any of the user's roles grants `action` on `moduleKey`. */
export function can(roles: AppRole[], moduleKey: string, action: Action): boolean {
  const mod = moduleFor(moduleKey);
  if (!mod) return false;
  return roles.some((r) => mod.perms[r]?.includes(action));
}

export interface PermissionDelta {
  module: string;
  gained: Action[];
  lost: Action[];
}

/** Module-by-module permission difference between two roles. */
export function diffRolePermissions(from: AppRole | null, to: AppRole | null): PermissionDelta[] {
  const out: PermissionDelta[] = [];
  for (const m of MODULES) {
    const before = from ? m.perms[from] ?? [] : [];
    const after = to ? m.perms[to] ?? [] : [];
    const gained = after.filter((a) => !before.includes(a));
    const lost = before.filter((a) => !after.includes(a));
    if (gained.length || lost.length) out.push({ module: m.label, gained, lost });
  }
  return out;
}

