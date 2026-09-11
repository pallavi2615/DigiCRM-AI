/**
 * DigiCRM AI product suite. The platform layer sits above industry packs:
 * every industry inherits these products, then configures terminology,
 * fields, stages, KPIs, automations and AI agents on top.
 */

export type ProductDef = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // lucide icon name
  gradient: string;
  capabilities: string[];
  /** In-app route when the module already exists. */
  appHref?: string;
  status: "live" | "beta" | "planned";
};

export const PRODUCTS: ProductDef[] = [
  {
    slug: "digicrm",
    name: "DigiCRM",
    tagline: "The core sales CRM.",
    description:
      "Leads, contacts, companies, deals and pipeline with tasks, meetings, calendar and a full activity timeline — the foundation every industry pack builds on.",
    icon: "LayoutDashboard",
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    capabilities: ["Leads", "Contacts", "Companies", "Deals", "Pipeline", "Tasks", "Meetings", "Calendar", "Activities"],
    appHref: "/dashboard",
    status: "live",
  },
  {
    slug: "digimarketing",
    name: "DigiMarketing",
    tagline: "Campaigns, journeys and attribution.",
    description:
      "Capture demand and nurture it across email, WhatsApp and SMS with landing pages, segmentation, journeys and source attribution.",
    icon: "Megaphone",
    gradient: "linear-gradient(135deg,#ec4899,#f97316)",
    capabilities: ["Campaigns", "Email", "WhatsApp", "SMS", "Landing pages", "Lead capture", "Segmentation", "Journeys", "Attribution"],
    appHref: "/landing-analytics",
    status: "beta",
  },
  {
    slug: "digisales",
    name: "DigiSales",
    tagline: "Field and inside-sales execution.",
    description:
      "Distribute leads instantly, run calling and field visits with GPS check-ins, and track targets, incentives and rep performance.",
    icon: "Navigation",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)",
    capabilities: ["Lead distribution", "Calling", "Field sales", "GPS check-in", "Visit management", "Targets", "Incentives", "Performance"],
    appHref: "/pipeline",
    status: "beta",
  },
  {
    slug: "digiservice",
    name: "DigiService",
    tagline: "Support that respects the SLA.",
    description:
      "Omnichannel ticketing with SLA policies, escalations, macros, a knowledge base and a customer portal for self-service.",
    icon: "LifeBuoy",
    gradient: "linear-gradient(135deg,#14b8a6,#0ea5e9)",
    capabilities: ["Tickets", "SLA", "Escalations", "Macros", "Knowledge base", "Customer portal", "WhatsApp support"],
    appHref: "/tickets",
    status: "live",
  },
  {
    slug: "digiai",
    name: "DigiAI",
    tagline: "Agents that actually do the work.",
    description:
      "An AI assistant grounded in your own data plus specialised agents for qualification, follow-up, proposals, support and voice.",
    icon: "Sparkles",
    gradient: "linear-gradient(135deg,#8b5cf6,#ec4899)",
    capabilities: ["AI assistant", "Sales agent", "Voice agent", "WhatsApp agent", "Lead qualification", "Proposal generator", "Follow-up agent", "Support agent"],
    appHref: "/ai",
    status: "live",
  },
  {
    slug: "digiflow",
    name: "DigiFlow",
    tagline: "No-code AI workflow builder.",
    description:
      "Compose triggers, conditions, AI decisions, actions and human approvals into workflows that run your operating model — not just reminders.",
    icon: "Workflow",
    gradient: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    capabilities: ["Triggers", "Conditions", "AI decisions", "Actions", "Human approval", "Branching", "Run history"],
    appHref: "/automation",
    status: "beta",
  },
  {
    slug: "digiverify",
    name: "DigiVerify",
    tagline: "Verification and KYC as a workflow step.",
    description:
      "PAN, Aadhaar, GST, bank account, Udyam, DL and RC checks plus document OCR and bureau pulls — callable from any workflow or record.",
    icon: "BadgeCheck",
    gradient: "linear-gradient(135deg,#10b981,#14b8a6)",
    capabilities: ["PAN", "Aadhaar", "GST", "Bank account", "Udyam", "DL / RC", "KYC / KYB", "Document OCR", "Bureau"],
    appHref: "/digiverify",
    status: "live",
  },
  {
    slug: "digiportal",
    name: "DigiPortal",
    tagline: "Portals for customers, partners and dealers.",
    description:
      "Give external users a branded, magic-link portal to check status, upload documents, raise tickets and make payments.",
    icon: "PanelsTopLeft",
    gradient: "linear-gradient(135deg,#64748b,#3b82f6)",
    capabilities: ["Applications", "Documents", "Tickets", "Payments", "Status", "Communication", "Tasks"],
    appHref: "/portal",
    status: "live",
  },
];

export function getProduct(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}
