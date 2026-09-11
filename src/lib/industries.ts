/**
 * Registry of supported industries. Powers /industries index and
 * dynamic /industries/$slug landing pages. Add a new entry here and
 * both surfaces update. Deep CRUD schemas (leads/deals tables) can
 * be added later per industry.
 */

export type IndustryFeature = { title: string; description: string; icon?: string };

export type IndustryPreset = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  gradient: string; // css gradient string
  accent: string; // tailwind color hint for badges
  icon: string; // lucide icon name — resolved in the component
  live: boolean; // whether a deep dashboard already exists
  liveHref?: string;
  benefits: string[];
  stages: string[];
  personas: string[];
  faq: Array<{ q: string; a: string }>;
  features?: IndustryFeature[];
};

/** Cross-cutting DigiCRM capabilities every industry inherits. */
export const CORE_FEATURES: IndustryFeature[] = [
  { title: "Kanban pipeline", description: "Drag-and-drop stages with realtime updates for the whole team.", icon: "Columns3" },
  { title: "AI Sales Assistant", description: "Draft follow-ups, summarize threads, and score leads with grounding on your own data.", icon: "Sparkles" },
  { title: "Webhook lead capture", description: "HMAC-signed inbound webhooks with retry and dead-letter queue.", icon: "Webhook" },
  { title: "Google Sheets & FB Lead Ads", description: "Sync leads from spreadsheets and Facebook Lead Ads in the background.", icon: "Share2" },
  { title: "White-label landing pages", description: "Per-tenant branded landing with source-attribution analytics.", icon: "Globe" },
  { title: "Audit log + RLS", description: "Row-level security for every table, plus a field-diff audit log.", icon: "ShieldCheck" },
];

export const INDUSTRIES: IndustryPreset[] = [
  {
    slug: "fintech-dsa",
    name: "Fintech / DSA CRM",
    tagline: "Loan pipelines, KYC & commissions on one screen.",
    description:
      "Manage loan applications end-to-end with 9-stage pipelines, lender routing, KYC document workflows and automated commission calculations.",
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6 50%,#ec4899)",
    accent: "violet",
    icon: "Landmark",
    live: true,
    liveHref: "/fintech",
    benefits: [
      "9-stage loan pipeline built for DSAs",
      "Multi-lender routing with rate cards",
      "KYC document uploads with audit trail",
      "Automated commission calculations",
    ],
    stages: ["Lead", "Docs", "Credit Check", "Bank Login", "Sanctioned", "Disbursed"],
    personas: ["DSA owners", "Loan officers", "Compliance leads"],
    faq: [
      { q: "Which loan products are supported?", a: "Personal, business, home, auto and LAP — configurable per lender." },
      { q: "Does it integrate with credit bureaus?", a: "Yes — via secure webhook connectors to major bureaus." },
    ],
  },
  {
    slug: "real-estate",
    name: "Real Estate Agency",
    tagline: "Match buyers to properties in minutes, not days.",
    description:
      "Property inventory, buyer matching, site-visit scheduling, KYC uploads and deal closure — all in a single workspace.",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444 60%,#ec4899)",
    accent: "amber",
    icon: "Home",
    live: true,
    liveHref: "/realestate",
    benefits: [
      "Property inventory with rich media",
      "Buyer matching & site-visit scheduling",
      "KYC document workflow with owner-scoped RLS",
      "Deal room from offer to closure",
    ],
    stages: ["Enquiry", "Qualified", "Site Visit", "Offer", "Booked", "Registered"],
    personas: ["Agency owners", "Sales agents", "Legal / compliance"],
    faq: [
      { q: "Can I list rentals and resale together?", a: "Yes — property types are fully customisable." },
      { q: "Is document sharing secure?", a: "All uploads are stored in a private bucket with RLS-scoped signed URLs." },
    ],
  },
  {
    slug: "it-company",
    name: "IT Services Company",
    tagline: "Projects, tickets & delivery signals in one CRM.",
    description:
      "Convert deals to projects, track tickets against SLA, and give account managers real-time delivery health.",
    gradient: "linear-gradient(135deg,#06b6d4,#3b82f6 60%,#6366f1)",
    accent: "cyan",
    icon: "Laptop",
    live: true,
    liveHref: "/it",
    benefits: [
      "Deal → project auto-conversion",
      "SLA-aware ticket workflows",
      "Real-time delivery dashboards",
      "Time & effort attribution",
    ],
    stages: ["Discovery", "Proposal", "Signed", "Delivery", "UAT", "Live"],
    personas: ["Account managers", "Delivery leads", "Support engineers"],
    faq: [
      { q: "Can we route tickets by SLA tier?", a: "Yes — automation rules pick priority owners and escalate on breach." },
    ],
  },
  {
    slug: "product-sales",
    name: "Product Sales / D2C",
    tagline: "Catalogue, orders, quotes & commissions.",
    description:
      "Manage a product catalogue, quote-to-cash flows, orders and commission engines with role-scoped visibility.",
    gradient: "linear-gradient(135deg,#10b981,#14b8a6 60%,#06b6d4)",
    accent: "emerald",
    icon: "Package",
    live: true,
    liveHref: "/productsales",
    benefits: [
      "Product catalogue with variants",
      "Quote-to-cash order flow",
      "Automated commission calculations",
      "Role-scoped order visibility",
    ],
    stages: ["Quote", "Approved", "Confirmed", "Fulfilled", "Invoiced", "Paid"],
    personas: ["Sales reps", "Ops managers", "Finance"],
    faq: [
      { q: "Can commissions be tiered?", a: "Yes — % is configurable per product / rep tier." },
    ],
  },
  {
    slug: "healthcare-clinics",
    name: "Healthcare & Clinics",
    tagline: "Patient enquiries to booked appointments.",
    description:
      "Capture patient enquiries across channels, route to specialists, and schedule appointments with reminders and follow-ups.",
    gradient: "linear-gradient(135deg,#14b8a6,#0ea5e9 60%,#6366f1)",
    accent: "teal",
    icon: "Stethoscope",
    live: false,
    benefits: [
      "Patient intake across WhatsApp, web & phone",
      "Specialist routing rules",
      "Appointment scheduling with reminders",
      "HIPAA-ready audit logs",
    ],
    stages: ["Enquiry", "Triage", "Scheduled", "Visited", "Follow-up"],
    personas: ["Clinic managers", "Front-desk staff", "Doctors"],
    faq: [
      { q: "Do you support multi-clinic groups?", a: "Yes — workspace-level roles keep clinics isolated." },
    ],
  },
  {
    slug: "education",
    name: "Education & EdTech",
    tagline: "Admissions, batches & renewals — automated.",
    description:
      "Track admission enquiries, counsellor pipelines, batch enrolments and renewal reminders in one place.",
    gradient: "linear-gradient(135deg,#f97316,#f59e0b 60%,#eab308)",
    accent: "orange",
    icon: "GraduationCap",
    live: false,
    benefits: [
      "Admission enquiry pipeline",
      "Counsellor assignment & follow-ups",
      "Batch enrolment & renewals",
      "Fee & scholarship tracking",
    ],
    stages: ["Enquiry", "Counselled", "Application", "Admitted", "Enrolled", "Renewed"],
    personas: ["Admissions officers", "Counsellors", "Academic leads"],
    faq: [
      { q: "Can we bulk-import leads from campaigns?", a: "Yes — CSV import supports column mapping." },
    ],
  },
  {
    slug: "insurance",
    name: "Insurance Brokers",
    tagline: "Policies, renewals & claims — under one roof.",
    description:
      "Quote engines, policy sales, renewal reminders and claims workflows with commission calculations per carrier.",
    gradient: "linear-gradient(135deg,#0ea5e9,#6366f1 60%,#8b5cf6)",
    accent: "sky",
    icon: "ShieldCheck",
    live: false,
    benefits: [
      "Multi-carrier quote engine",
      "Renewal reminder automation",
      "Claims workflow",
      "Commission ledger",
    ],
    stages: ["Quote", "Proposal", "Issued", "Active", "Renewal Due", "Renewed"],
    personas: ["Brokers", "Renewal desk", "Claims managers"],
    faq: [
      { q: "Can we manage multiple LOBs (Life / Motor / Health)?", a: "Yes — each LOB gets its own pipeline template." },
    ],
  },
  {
    slug: "automotive",
    name: "Automotive Dealership",
    tagline: "Test drives to signed contracts.",
    description:
      "Vehicle inventory, test-drive scheduling, financing partners and delivery pipelines for auto dealerships.",
    gradient: "linear-gradient(135deg,#ef4444,#f97316 60%,#f59e0b)",
    accent: "red",
    icon: "Car",
    live: false,
    benefits: [
      "Vehicle inventory with photos & specs",
      "Test-drive scheduling",
      "Financing partner routing",
      "Delivery & handover tracking",
    ],
    stages: ["Enquiry", "Test Drive", "Quote", "Financed", "Booked", "Delivered"],
    personas: ["Showroom managers", "Sales advisors", "Finance desk"],
    faq: [
      { q: "Can we track pre-owned inventory?", a: "Yes — new and pre-owned share the same inventory schema." },
    ],
  },
  {
    slug: "travel",
    name: "Travel Agency",
    tagline: "Itineraries, quotes & bookings.",
    description:
      "Build itineraries, generate quotes, collect deposits and manage bookings from a single traveller pipeline.",
    gradient: "linear-gradient(135deg,#ec4899,#8b5cf6 60%,#6366f1)",
    accent: "pink",
    icon: "Plane",
    live: false,
    benefits: [
      "Itinerary builder with per-day plans",
      "Auto-generated quote PDFs",
      "Deposit collection & reminders",
      "Group booking management",
    ],
    stages: ["Enquiry", "Quoted", "Deposit", "Confirmed", "Travelled", "Reviewed"],
    personas: ["Travel consultants", "Ops team", "Owners"],
    faq: [
      { q: "Can we work with multiple currencies?", a: "Yes — quotes support multi-currency." },
    ],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing / B2B",
    tagline: "RFQs, quotations & long sales cycles.",
    description:
      "Long-cycle B2B sales with RFQs, technical quotations, sample tracking and order fulfilment integrated with your ERP.",
    gradient: "linear-gradient(135deg,#64748b,#475569 60%,#334155)",
    accent: "slate",
    icon: "Factory",
    live: false,
    benefits: [
      "RFQ intake & technical quotations",
      "Sample dispatch tracking",
      "Multi-approver deal flow",
      "ERP-friendly exports",
    ],
    stages: ["Enquiry", "RFQ", "Sample", "Quote", "PO", "Delivered"],
    personas: ["BD managers", "Application engineers", "Ops"],
    faq: [
      { q: "Can we integrate with our ERP?", a: "Yes — webhook & CSV bridges are available." },
    ],
  },
];

export function getIndustry(slug: string): IndustryPreset | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}
