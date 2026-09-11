/**
 * Industry pack engine.
 *
 * A pack is configuration over one shared record object (`pack_records`):
 * the same "deal" becomes a Loan Application, a Property Deal, an Admission
 * or a Shipment — with its own terminology, stages, fields, KPIs, AI agents
 * and verification requirements.
 *
 * Stages, KPI labels and agent names come from the taxonomy
 * (`src/lib/industry-taxonomy.ts`); this file adds the workspace behaviour.
 */

import { INDUSTRY_GROUPS, type SubIndustry } from "./industry-taxonomy";

export type PackFieldType = "text" | "number" | "date" | "select" | "textarea";

export type PackField = {
  key: string;
  label: string;
  type: PackFieldType;
  options?: string[];
  placeholder?: string;
};

export type VerificationKind = "pan" | "aadhaar" | "gst" | "bank_account" | "document_ocr" | "bureau";

export type PackAgent = {
  key: string;
  label: string;
  description: string;
  /** Extra instruction appended to the shared industry-agent system prompt. */
  instruction: string;
};

export type IndustryPack = {
  group: string;
  groupName: string;
  groupGradient: string;
  slug: string;
  name: string;
  tagline: string;
  /** Terminology: what one record is called in this vertical. */
  recordLabel: string;
  recordLabelPlural: string;
  /** Terminology: what the counterparty is called. */
  partyLabel: string;
  /** Currency-style value label, e.g. "Loan amount". */
  valueLabel: string;
  stages: string[];
  wonStages: string[];
  lostStages: string[];
  fields: PackField[];
  agents: PackAgent[];
  kpiLabels: string[];
  verifications: VerificationKind[];
  objects: string[];
};

/** Groups that ship a real in-app workspace. */
export const PACK_GROUPS = [
  "financial-services",
  "property",
  "commerce",
  "mobility-supply-chain",
  "healthcare",
  "education",
  "industrial",
  "professional-services",
] as const;

type PackConfig = {
  recordLabel: string;
  recordLabelPlural: string;
  partyLabel: string;
  valueLabel: string;
  wonStages: string[];
  lostStages?: string[];
  fields: PackField[];
  verifications: VerificationKind[];
  agentInstructions?: Record<string, string>;
};

const f = (key: string, label: string, type: PackFieldType = "text", options?: string[]): PackField => ({
  key,
  label,
  type,
  ...(options ? { options } : {}),
});

const OWNER_FIELDS: PackField[] = [];

/** Per sub-industry workspace configuration. */
const CONFIG: Record<string, PackConfig> = {
  // ---------------- Financial Services ----------------
  fintech: {
    recordLabel: "Application", recordLabelPlural: "Applications", partyLabel: "Customer", valueLabel: "Requested amount",
    wonStages: ["Activated"], lostStages: [],
    fields: [
      f("product", "Product", "select", ["Savings", "Credit card", "Wallet", "Personal loan", "BNPL", "Investment"]),
      f("channel", "Acquisition channel", "select", ["Website", "App", "Referral", "Partner", "Paid ads", "Branch"]),
      f("kyc_status", "KYC status", "select", ["Not started", "In progress", "Verified", "Rejected"]),
      f("monthly_income", "Monthly income", "number"),
      f("risk_band", "Risk band", "select", ["Low", "Medium", "High"]),
    ],
    verifications: ["pan", "aadhaar", "bank_account", "bureau"],
  },
  lending: {
    recordLabel: "Loan application", recordLabelPlural: "Loan applications", partyLabel: "Applicant", valueLabel: "Loan amount",
    wonStages: ["Disbursed"], lostStages: [],
    fields: [
      f("loan_type", "Loan type", "select", ["Personal", "Business", "Home", "LAP", "Auto", "Education", "Gold"]),
      f("lender", "Lender"),
      f("tenure_months", "Tenure (months)", "number"),
      f("roi", "Rate of interest (%)", "number"),
      f("employment_type", "Employment", "select", ["Salaried", "Self employed", "Business", "Professional"]),
      f("monthly_income", "Monthly income", "number"),
      f("existing_emi", "Existing EMI", "number"),
      f("payout_pct", "DSA payout (%)", "number"),
    ],
    verifications: ["pan", "aadhaar", "bank_account", "document_ocr", "bureau"],
  },
  banking: {
    recordLabel: "Relationship", recordLabelPlural: "Relationships", partyLabel: "Customer", valueLabel: "Expected balance",
    wonStages: ["Funded", "Cross-sell"], lostStages: [],
    fields: [
      f("branch", "Branch"),
      f("account_type", "Account type", "select", ["Savings", "Current", "Salary", "NRI", "Fixed deposit"]),
      f("relationship_manager", "Relationship manager"),
      f("cross_sell", "Cross-sell interest", "select", ["Card", "Loan", "Insurance", "Investment", "None"]),
    ],
    verifications: ["pan", "aadhaar", "bank_account"],
  },
  insurance: {
    recordLabel: "Policy", recordLabelPlural: "Policies", partyLabel: "Policyholder", valueLabel: "Premium",
    wonStages: ["Issued", "Active", "Renewed"], lostStages: [],
    fields: [
      f("line_of_business", "Line of business", "select", ["Life", "Health", "Motor", "Commercial", "Travel"]),
      f("carrier", "Carrier"),
      f("sum_assured", "Sum assured", "number"),
      f("renewal_date", "Renewal date", "date"),
      f("commission_pct", "Commission (%)", "number"),
    ],
    verifications: ["pan", "aadhaar", "document_ocr"],
  },
  "wealth-investment": {
    recordLabel: "Mandate", recordLabelPlural: "Mandates", partyLabel: "Investor", valueLabel: "AUM committed",
    wonStages: ["Invested", "Onboarded", "Active"], lostStages: [],
    fields: [
      f("risk_profile", "Risk profile", "select", ["Conservative", "Balanced", "Aggressive"]),
      f("product_mix", "Product mix", "select", ["Mutual funds", "PMS", "AIF", "Bonds", "Equity", "Mixed"]),
      f("sip_amount", "Monthly SIP", "number"),
      f("advisor", "Advisor"),
    ],
    verifications: ["pan", "aadhaar", "bank_account"],
  },
  broking: {
    recordLabel: "Account", recordLabelPlural: "Accounts", partyLabel: "Trader", valueLabel: "Expected turnover",
    wonStages: ["Activated", "Funded", "Trading"], lostStages: [],
    fields: [
      f("segment", "Segment", "select", ["Equity", "F&O", "Commodity", "Currency"]),
      f("plan", "Brokerage plan"),
      f("referral_code", "Referral code"),
    ],
    verifications: ["pan", "aadhaar", "bank_account"],
  },
  payments: {
    recordLabel: "Merchant", recordLabelPlural: "Merchants", partyLabel: "Merchant", valueLabel: "Expected GMV",
    wonStages: ["Live", "Transacting", "Activated"], lostStages: [],
    fields: [
      f("business_type", "Business type", "select", ["Retail", "Online", "Services", "Marketplace", "Enterprise"]),
      f("mdr_pct", "MDR (%)", "number"),
      f("integration", "Integration", "select", ["Payment link", "Hosted checkout", "API", "POS terminal"]),
      f("monthly_volume", "Monthly volume", "number"),
    ],
    verifications: ["pan", "gst", "bank_account", "document_ocr"],
  },

  // ---------------- Property ----------------
  "real-estate": {
    recordLabel: "Property deal", recordLabelPlural: "Property deals", partyLabel: "Buyer", valueLabel: "Deal value",
    wonStages: ["Booking", "Agreement", "Registered"], lostStages: [],
    fields: [
      f("project", "Project / society"),
      f("property_type", "Property type", "select", ["Apartment", "Villa", "Plot", "Commercial", "Rental"]),
      f("configuration", "Configuration", "select", ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Office", "Shop"]),
      f("budget_min", "Budget min", "number"),
      f("budget_max", "Budget max", "number"),
      f("site_visit_at", "Site visit", "date"),
      f("channel_partner", "Channel partner"),
    ],
    verifications: ["pan", "aadhaar", "document_ocr"],
  },
  construction: {
    recordLabel: "Project enquiry", recordLabelPlural: "Project enquiries", partyLabel: "Client", valueLabel: "Contract value",
    wonStages: ["Contract", "Project", "Completion"], lostStages: [],
    fields: [
      f("scope", "Scope", "select", ["Civil", "Interiors", "Turnkey", "Renovation", "Infrastructure"]),
      f("site_area", "Site area (sq ft)", "number"),
      f("estimate_version", "Estimate version"),
      f("boq_status", "BOQ status", "select", ["Not started", "Drafted", "Shared", "Approved"]),
      f("start_date", "Target start", "date"),
    ],
    verifications: ["pan", "gst", "document_ocr"],
  },
  "property-management": {
    recordLabel: "Lease", recordLabelPlural: "Leases", partyLabel: "Tenant", valueLabel: "Monthly rent",
    wonStages: ["Lease", "Move-in", "Renewal"], lostStages: [],
    fields: [
      f("unit", "Unit"),
      f("owner_name", "Owner"),
      f("lease_start", "Lease start", "date"),
      f("lease_months", "Lease term (months)", "number"),
      f("deposit", "Security deposit", "number"),
      f("maintenance_plan", "Maintenance plan", "select", ["Basic", "Standard", "Premium"]),
    ],
    verifications: ["pan", "aadhaar", "bank_account", "document_ocr"],
  },

  // ---------------- Commerce ----------------
  retail: {
    recordLabel: "Store opportunity", recordLabelPlural: "Store opportunities", partyLabel: "Shopper", valueLabel: "Basket value",
    wonStages: ["Purchased", "Repeat", "Loyalty"], lostStages: [],
    fields: [
      f("store", "Store"),
      f("category", "Category"),
      f("loyalty_tier", "Loyalty tier", "select", ["None", "Silver", "Gold", "Platinum"]),
      f("visit_at", "Store visit", "date"),
    ],
    verifications: ["gst"],
  },
  ecommerce: {
    recordLabel: "Order opportunity", recordLabelPlural: "Order opportunities", partyLabel: "Customer", valueLabel: "Cart value",
    wonStages: ["Delivered", "Purchased", "Repeat"], lostStages: [],
    fields: [
      f("channel", "Channel", "select", ["Website", "App", "Marketplace", "Social", "WhatsApp"]),
      f("cart_id", "Cart / order ID"),
      f("payment_mode", "Payment mode", "select", ["Prepaid", "COD", "EMI", "Wallet"]),
      f("abandoned_at", "Cart abandoned", "date"),
    ],
    verifications: ["bank_account"],
  },
  "consumer-goods": {
    recordLabel: "Trade deal", recordLabelPlural: "Trade deals", partyLabel: "Retailer", valueLabel: "Order value",
    wonStages: ["Order", "Fulfilled", "Reordered"], lostStages: [],
    fields: [
      f("outlet_type", "Outlet type", "select", ["Kirana", "Supermarket", "Modern trade", "HoReCa", "Wholesale"]),
      f("beat", "Beat / route"),
      f("sku_count", "SKUs pitched", "number"),
      f("scheme", "Scheme applied"),
    ],
    verifications: ["gst", "pan", "bank_account"],
  },
  distribution: {
    recordLabel: "Distributor deal", recordLabelPlural: "Distributor deals", partyLabel: "Distributor", valueLabel: "Annual potential",
    wonStages: ["Appointed", "Onboarded", "Stocked"], lostStages: [],
    fields: [
      f("territory", "Territory"),
      f("credit_limit", "Credit limit", "number"),
      f("warehouse_sqft", "Warehouse (sq ft)", "number"),
      f("agreement_date", "Agreement date", "date"),
    ],
    verifications: ["gst", "pan", "bank_account", "document_ocr"],
  },

  // ---------------- Mobility & Supply Chain ----------------
  logistics: {
    recordLabel: "Shipment deal", recordLabelPlural: "Shipment deals", partyLabel: "Shipper", valueLabel: "Contract value",
    wonStages: ["Contract", "Onboarded", "Shipping"], lostStages: [],
    fields: [
      f("lane", "Lane (origin → destination)"),
      f("mode", "Mode", "select", ["FTL", "LTL", "Air", "Rail", "Ocean", "Last mile"]),
      f("monthly_volume", "Monthly volume (tonnes)", "number"),
      f("sla_hours", "Promised SLA (hours)", "number"),
    ],
    verifications: ["gst", "pan", "document_ocr"],
  },
  transportation: {
    recordLabel: "Trip contract", recordLabelPlural: "Trip contracts", partyLabel: "Client", valueLabel: "Contract value",
    wonStages: ["Contract", "Running", "Renewed"], lostStages: [],
    fields: [
      f("vehicle_type", "Vehicle type", "select", ["Car", "Van", "Bus", "Truck", "Trailer"]),
      f("fleet_size", "Fleet required", "number"),
      f("contract_months", "Contract length (months)", "number"),
      f("route", "Route"),
    ],
    verifications: ["gst", "pan", "document_ocr"],
  },
  automotive: {
    recordLabel: "Vehicle deal", recordLabelPlural: "Vehicle deals", partyLabel: "Buyer", valueLabel: "On-road price",
    wonStages: ["Booked", "Delivered", "Financed"], lostStages: [],
    fields: [
      f("model", "Model"),
      f("variant", "Variant"),
      f("test_drive_at", "Test drive", "date"),
      f("exchange", "Exchange vehicle", "select", ["None", "Yes — valuation pending", "Yes — valued"]),
      f("finance_partner", "Finance partner"),
      f("down_payment", "Down payment", "number"),
    ],
    verifications: ["pan", "aadhaar", "bank_account", "bureau"],
  },
  "travel-hospitality": {
    recordLabel: "Booking", recordLabelPlural: "Bookings", partyLabel: "Traveller", valueLabel: "Package value",
    wonStages: ["Confirmed", "Travelled", "Reviewed"], lostStages: [],
    fields: [
      f("destination", "Destination"),
      f("travel_date", "Travel date", "date"),
      f("pax", "Travellers", "number"),
      f("package_type", "Package", "select", ["Domestic", "International", "Group", "MICE", "Custom"]),
      f("deposit_paid", "Deposit paid", "number"),
    ],
    verifications: ["pan", "document_ocr"],
  },

  // ---------------- Healthcare ----------------
  hospitals: {
    recordLabel: "Patient case", recordLabelPlural: "Patient cases", partyLabel: "Patient", valueLabel: "Estimated bill",
    wonStages: ["Admitted", "Treated", "Discharged"], lostStages: [],
    fields: [
      f("department", "Department", "select", ["Cardiology", "Orthopaedics", "Oncology", "Neurology", "General", "Maternity"]),
      f("consultant", "Consultant"),
      f("admission_type", "Admission", "select", ["OPD", "Day care", "IPD", "Emergency"]),
      f("insurer", "Insurer / TPA"),
      f("appointment_at", "Appointment", "date"),
    ],
    verifications: ["aadhaar", "document_ocr"],
  },
  clinics: {
    recordLabel: "Appointment", recordLabelPlural: "Appointments", partyLabel: "Patient", valueLabel: "Consultation value",
    wonStages: ["Visited", "Follow-up", "Treated"], lostStages: [],
    fields: [
      f("speciality", "Speciality", "select", ["Dental", "Derma", "Physio", "Eye", "ENT", "General"]),
      f("doctor", "Doctor"),
      f("appointment_at", "Appointment", "date"),
      f("treatment_plan", "Treatment plan"),
    ],
    verifications: ["aadhaar", "document_ocr"],
  },
  diagnostics: {
    recordLabel: "Test order", recordLabelPlural: "Test orders", partyLabel: "Patient", valueLabel: "Order value",
    wonStages: ["Reported", "Collected", "Delivered"], lostStages: [],
    fields: [
      f("test_panel", "Test / panel"),
      f("collection_type", "Collection", "select", ["Home collection", "Walk-in", "Corporate camp"]),
      f("collection_at", "Collection slot", "date"),
      f("referring_doctor", "Referring doctor"),
    ],
    verifications: ["aadhaar", "document_ocr"],
  },
  healthtech: {
    recordLabel: "Subscription", recordLabelPlural: "Subscriptions", partyLabel: "Member", valueLabel: "Plan value",
    wonStages: ["Subscribed", "Active", "Renewed"], lostStages: [],
    fields: [
      f("plan", "Plan", "select", ["Trial", "Monthly", "Quarterly", "Annual", "Corporate"]),
      f("care_programme", "Care programme"),
      f("onboarded_at", "Onboarded", "date"),
    ],
    verifications: ["aadhaar", "bank_account"],
  },

  // ---------------- Education ----------------
  "higher-education": {
    recordLabel: "Application", recordLabelPlural: "Applications", partyLabel: "Applicant", valueLabel: "Programme fee",
    wonStages: ["Admitted", "Enrolled", "Fee Paid"], lostStages: [],
    fields: [
      f("programme", "Programme"),
      f("intake", "Intake", "select", ["Spring", "Summer", "Monsoon", "Fall", "Winter"]),
      f("qualification", "Highest qualification"),
      f("counsellor", "Counsellor"),
      f("scholarship_pct", "Scholarship (%)", "number"),
    ],
    verifications: ["aadhaar", "document_ocr"],
  },
  edtech: {
    recordLabel: "Enrolment", recordLabelPlural: "Enrolments", partyLabel: "Learner", valueLabel: "Course fee",
    wonStages: ["Enrolled", "Paid", "Renewed"], lostStages: [],
    fields: [
      f("course", "Course"),
      f("cohort", "Cohort / batch"),
      f("demo_at", "Demo class", "date"),
      f("payment_plan", "Payment plan", "select", ["Full", "EMI", "Income share", "Scholarship"]),
    ],
    verifications: ["aadhaar", "bank_account"],
  },
  coaching: {
    recordLabel: "Admission", recordLabelPlural: "Admissions", partyLabel: "Student", valueLabel: "Batch fee",
    wonStages: ["Admitted", "Enrolled", "Renewed"], lostStages: [],
    fields: [
      f("exam_target", "Target exam"),
      f("batch", "Batch"),
      f("mode", "Mode", "select", ["Classroom", "Online", "Hybrid"]),
      f("counselling_at", "Counselling session", "date"),
      f("fee_pending", "Fee pending", "number"),
    ],
    verifications: ["aadhaar", "document_ocr"],
  },
  "career-training": {
    recordLabel: "Placement track", recordLabelPlural: "Placement tracks", partyLabel: "Candidate", valueLabel: "Programme fee",
    wonStages: ["Enrolled", "Certified", "Placed"], lostStages: [],
    fields: [
      f("track", "Track"),
      f("experience_years", "Experience (years)", "number"),
      f("placement_target", "Target role"),
      f("cohort_start", "Cohort start", "date"),
    ],
    verifications: ["aadhaar", "document_ocr"],
  },

  // ---------------- Industrial ----------------
  manufacturing: {
    recordLabel: "RFQ deal", recordLabelPlural: "RFQ deals", partyLabel: "Buyer", valueLabel: "Order value",
    wonStages: ["PO", "Production", "Dispatched", "Collected"], lostStages: [],
    fields: [
      f("product_line", "Product line"),
      f("rfq_number", "RFQ number"),
      f("dealer", "Dealer / distributor"),
      f("quantity", "Quantity", "number"),
      f("sample_status", "Sample status", "select", ["Not required", "Requested", "Shipped", "Approved", "Rejected"]),
      f("dispatch_date", "Target dispatch", "date"),
      f("payment_terms", "Payment terms", "select", ["Advance", "50/50", "Net 30", "Net 45", "Net 60", "LC"]),
    ],
    verifications: ["gst", "pan", "bank_account", "document_ocr"],
  },
  energy: {
    recordLabel: "Site project", recordLabelPlural: "Site projects", partyLabel: "Site owner", valueLabel: "Project value",
    wonStages: ["Order", "Installation", "Commissioned", "AMC"], lostStages: [],
    fields: [
      f("segment", "Segment", "select", ["Residential", "Commercial", "Industrial", "Utility", "Government"]),
      f("system_kw", "System size (kW)", "number"),
      f("monthly_units", "Monthly consumption (units)", "number"),
      f("survey_at", "Site survey", "date"),
      f("subsidy_status", "Subsidy / net metering", "select", ["Not applicable", "Pending", "Applied", "Approved"]),
      f("commissioning_date", "Target commissioning", "date"),
      f("amc_plan", "AMC plan", "select", ["None", "1 year", "3 years", "5 years"]),
    ],
    verifications: ["gst", "pan", "document_ocr"],
  },
  engineering: {
    recordLabel: "Technical enquiry", recordLabelPlural: "Technical enquiries", partyLabel: "Client", valueLabel: "Contract value",
    wonStages: ["Order", "Execution", "Handover"], lostStages: [],
    fields: [
      f("discipline", "Discipline", "select", ["Civil", "Mechanical", "Electrical", "Process", "Instrumentation", "Multi-discipline"]),
      f("spec_reference", "Specification reference"),
      f("submittal_status", "Submittal status", "select", ["Not started", "Drafted", "Submitted", "Approved", "Rework"]),
      f("approver", "Approving authority"),
      f("consultant", "Consultant / EPC"),
      f("handover_date", "Target handover", "date"),
    ],
    verifications: ["gst", "pan", "document_ocr"],
  },
  "b2b-services": {
    recordLabel: "Account deal", recordLabelPlural: "Account deals", partyLabel: "Account", valueLabel: "Contract value",
    wonStages: ["Contract", "Delivery", "Renewal"], lostStages: [],
    fields: [
      f("service_line", "Service line"),
      f("contract_months", "Contract length (months)", "number"),
      f("sla_tier", "SLA tier", "select", ["Standard", "Priority", "Enterprise"]),
      f("renewal_date", "Renewal date", "date"),
      f("expansion_potential", "Expansion potential", "number"),
    ],
    verifications: ["gst", "pan", "bank_account"],
  },

  // ---------------- Professional Services ----------------
  consulting: {
    recordLabel: "Engagement", recordLabelPlural: "Engagements", partyLabel: "Client", valueLabel: "Engagement fee",
    wonStages: ["Signed", "Delivery", "Invoiced", "Closed"], lostStages: [],
    fields: [
      f("practice", "Practice area"),
      f("engagement_type", "Engagement type", "select", ["Fixed fee", "Time & material", "Retainer", "Success fee"]),
      f("duration_weeks", "Duration (weeks)", "number"),
      f("team_size", "Consultants required", "number"),
      f("start_date", "Target start", "date"),
      f("day_rate", "Blended day rate", "number"),
    ],
    verifications: ["gst", "pan", "bank_account"],
  },
  agencies: {
    recordLabel: "Brief", recordLabelPlural: "Briefs", partyLabel: "Client", valueLabel: "Retainer value",
    wonStages: ["Won", "In Delivery", "Approved", "Invoiced"], lostStages: [],
    fields: [
      f("service", "Service", "select", ["Brand", "Performance", "Content", "Social", "Web", "Full service"]),
      f("engagement_model", "Model", "select", ["Retainer", "Project", "Performance-linked"]),
      f("retainer_months", "Retainer length (months)", "number"),
      f("pitch_date", "Pitch date", "date"),
      f("deliverables", "Key deliverables", "textarea"),
    ],
    verifications: ["gst", "pan", "bank_account"],
  },
  legal: {
    recordLabel: "Matter", recordLabelPlural: "Matters", partyLabel: "Client", valueLabel: "Retainer / fee",
    wonStages: ["Engagement Letter", "Matter Open", "In Progress", "Closed"], lostStages: [],
    fields: [
      f("practice_area", "Practice area", "select", ["Corporate", "Litigation", "IP", "Real estate", "Employment", "Tax", "Compliance"]),
      f("matter_type", "Matter type"),
      f("conflict_check", "Conflict check", "select", ["Pending", "Cleared", "Conflict found"]),
      f("lead_partner", "Lead partner"),
      f("next_hearing", "Next hearing", "date"),
      f("billing_model", "Billing model", "select", ["Hourly", "Fixed fee", "Retainer", "Contingency"]),
    ],
    verifications: ["pan", "aadhaar", "gst", "document_ocr"],
  },
  "it-services": {
    recordLabel: "Delivery deal", recordLabelPlural: "Delivery deals", partyLabel: "Client", valueLabel: "Contract value",
    wonStages: ["Signed", "Delivery", "UAT", "Live", "Renewal"], lostStages: [],
    fields: [
      f("service_type", "Service type", "select", ["Custom build", "Managed services", "Cloud / DevOps", "Data & AI", "Support", "Staff augmentation"]),
      f("tech_stack", "Tech stack"),
      f("engagement_model", "Engagement model", "select", ["Fixed bid", "Time & material", "Dedicated team", "Outcome-based"]),
      f("team_size", "Team size", "number"),
      f("go_live_date", "Target go-live", "date"),
      f("sla_tier", "SLA tier", "select", ["Standard", "Priority", "24x7"]),
    ],
    verifications: ["gst", "pan", "bank_account"],
  },
  staffing: {
    recordLabel: "Requisition", recordLabelPlural: "Requisitions", partyLabel: "Client", valueLabel: "Placement value",
    wonStages: ["Offer", "Joined", "Invoiced"], lostStages: [],
    fields: [
      f("role_title", "Role title"),
      f("positions", "Open positions", "number"),
      f("hiring_type", "Hiring type", "select", ["Permanent", "Contract", "Contract to hire", "RPO"]),
      f("experience_years", "Experience required (years)", "number"),
      f("ctc_budget", "CTC budget", "number"),
      f("margin_pct", "Margin (%)", "number"),
      f("target_join_date", "Target joining", "date"),
    ],
    verifications: ["pan", "aadhaar", "document_ocr"],
  },
};


/** Group-level agent instructions layered on top of every pack agent. */
const GROUP_AGENT_CONTEXT: Record<string, string> = {
  "financial-services":
    "You operate under Indian financial-services norms: never promise sanction or approval, flag missing KYC or income proof, and keep every recommendation auditable.",
  property:
    "You work with property inventory and buyers: reason about budget fit, configuration, locality and site-visit momentum.",
  commerce:
    "You work with retail and trade motion: reason about basket size, reorder cadence, scheme fit and channel economics.",
  "mobility-supply-chain":
    "You work with lanes, fleets and SLAs: reason about capacity, transit time, cost per unit and on-time performance.",
  healthcare:
    "You handle patient information: be factual, never give clinical advice or a diagnosis, and keep personal health details minimal and respectful.",
  education:
    "You work with learners and counsellors: reason about eligibility, intake deadlines, fee plans and drop-off risk.",
  industrial:
    "You work with technical, RFQ-driven B2B selling: reason about specifications, quantities, lead times, approvals, dispatch and payment terms.",
  "professional-services":
    "You work with people-delivered engagements: reason about scope, staffing and utilisation, billing model, delivery risk and renewal or repeat business.",
};


const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function buildAgents(sub: SubIndustry, group: string, cfg: PackConfig): PackAgent[] {
  const groupCtx = GROUP_AGENT_CONTEXT[group] ?? "";
  return sub.agents.map((name) => {
    const key = slugify(name);
    const custom = cfg.agentInstructions?.[key];
    return {
      key,
      label: name,
      description: `${name} for ${sub.name}`,
      instruction:
        custom ??
        `${groupCtx} Act as the "${name}" for a ${sub.name} team. Work only from the record data supplied. ` +
          `Respond with a short, specific, immediately usable output: the recommended next action, the reasoning in one line, ` +
          `and any missing information that blocks progress. Never invent facts that are not in the record.`,
    };
  });
}

function buildPack(groupSlug: string, sub: SubIndustry): IndustryPack | undefined {
  const group = INDUSTRY_GROUPS.find((g) => g.slug === groupSlug)!;
  const cfg = CONFIG[sub.slug];
  if (!cfg) return undefined;
  const won = cfg.wonStages.filter((w) => sub.stages.includes(w));
  return {
    group: groupSlug,
    groupName: group.name,
    groupGradient: group.gradient,
    slug: sub.slug,
    name: sub.name,
    tagline: sub.tagline,
    recordLabel: cfg.recordLabel,
    recordLabelPlural: cfg.recordLabelPlural,
    partyLabel: cfg.partyLabel,
    valueLabel: cfg.valueLabel,
    stages: sub.stages,
    wonStages: won.length > 0 ? won : [sub.stages[sub.stages.length - 1]!],
    lostStages: cfg.lostStages ?? [],
    fields: [...cfg.fields, ...OWNER_FIELDS],
    agents: buildAgents(sub, groupSlug, cfg),
    kpiLabels: sub.kpis,
    verifications: cfg.verifications,
    objects: sub.objects,
  };
}

export const INDUSTRY_PACKS: IndustryPack[] = INDUSTRY_GROUPS.filter((g) =>
  (PACK_GROUPS as readonly string[]).includes(g.slug),
).flatMap((g) => g.children.map((c) => buildPack(g.slug, c)).filter((p): p is IndustryPack => !!p));

export function getPack(group: string, slug: string): IndustryPack | undefined {
  return INDUSTRY_PACKS.find((p) => p.group === group && p.slug === slug);
}

export function packsByGroup(): Array<{ slug: string; name: string; gradient: string; packs: IndustryPack[] }> {
  return (PACK_GROUPS as readonly string[]).map((gs) => {
    const g = INDUSTRY_GROUPS.find((x) => x.slug === gs)!;
    return { slug: g.slug, name: g.name, gradient: g.gradient, packs: INDUSTRY_PACKS.filter((p) => p.group === gs) };
  });
}

export const VERIFICATION_LABELS: Record<VerificationKind, string> = {
  pan: "PAN",
  aadhaar: "Aadhaar",
  gst: "GSTIN",
  bank_account: "Bank account",
  document_ocr: "Document OCR",
  bureau: "Credit bureau",
};
