export type IndustryTemplate = {
  slug: string;
  industry: string;
  title: string;
  hero_headline: string;
  hero_subheadline: string;
  cta_label: string;
  features: { title: string; description: string }[];
  testimonial: string;
};

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    slug: "fintech",
    industry: "Fintech / DSA",
    title: "Loans, faster.",
    hero_headline: "Turn every enquiry into a funded loan.",
    hero_subheadline: "A modern lending CRM for DSAs and lenders — KYC, eligibility, disbursal and commissions in one workflow.",
    cta_label: "Get a demo",
    features: [
      { title: "Loan pipeline", description: "Track applications from lead to disbursal with lender rules baked in." },
      { title: "KYC & docs", description: "Collect, verify and store documents with audit trails." },
      { title: "Commission engine", description: "Auto-calculate DSA payouts per lender and product." },
    ],
    testimonial: "We doubled our disbursal rate in the first quarter after switching.",
  },
  {
    slug: "real-estate",
    industry: "Real Estate",
    title: "Every enquiry, every property, in one place.",
    hero_headline: "Sell more properties, faster.",
    hero_subheadline: "Match buyers to properties, run KYC, and close deals — with commission tracking built in.",
    cta_label: "Book a walkthrough",
    features: [
      { title: "Property matching", description: "Auto-match buyers to inventory with smart filters." },
      { title: "Site visits", description: "Schedule visits, capture feedback, and follow up automatically." },
      { title: "Broker payouts", description: "Track commissions across builders, brokers, and channel partners." },
    ],
    testimonial: "Our sales cycle dropped by 40% within two months.",
  },
  {
    slug: "it-services",
    industry: "IT Services",
    title: "From RFP to renewal, on one platform.",
    hero_headline: "Ship projects, delight clients.",
    hero_subheadline: "A CRM built for consultancies and software teams — pipeline, projects, tickets and delivery in sync.",
    cta_label: "Start a trial",
    features: [
      { title: "Project pipeline", description: "Track proposals, SOWs and delivery milestones together." },
      { title: "Ticket helpdesk", description: "Support your clients with SLAs and shared inbox." },
      { title: "Utilization", description: "See who's billable, who's benched, and where margin lives." },
    ],
    testimonial: "The support inbox alone paid for itself in a month.",
  },
  {
    slug: "product-sales",
    industry: "Product Sales",
    title: "Catalog to cash, no spreadsheets.",
    hero_headline: "One system for orders, products, and reps.",
    hero_subheadline: "Give your reps a mobile catalog, capture orders on the go, and pay commissions automatically.",
    cta_label: "See it in action",
    features: [
      { title: "Live catalog", description: "Real-time stock, pricing and offers your reps can trust." },
      { title: "Order capture", description: "Quotes, orders and invoices from any device." },
      { title: "Rep payouts", description: "Commissions computed as orders confirm — no month-end drama." },
    ],
    testimonial: "Our reps love it. Orders up, disputes down.",
  },
];

export function getIndustryTemplate(slug: string) {
  return INDUSTRY_TEMPLATES.find((t) => t.slug === slug);
}
