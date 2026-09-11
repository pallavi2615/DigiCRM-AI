/**
 * DigiCRM AI industry taxonomy — two levels: group → sub-industry.
 *
 * This registry is the single source of truth for the public industry
 * navigation, the /industries index, group pages and sub-industry
 * landing pages. Workspace behaviour (fields, KPIs, automations) lives
 * separately in the industry packs registry.
 */

export type SubIndustry = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** Core CRM objects this vertical works with. */
  objects: string[];
  /** Default pipeline stages. */
  stages: string[];
  /** Headline metrics on the industry dashboard. */
  kpis: string[];
  personas: string[];
  /** Industry-specific AI agents shipped with the pack. */
  agents: string[];
  faq: Array<{ q: string; a: string }>;
  /** True when a deep in-app workspace already exists. */
  live?: boolean;
  liveHref?: string;
  /** Legacy /industries/<slug> aliases that should redirect here. */
  aliases?: string[];
};

export type IndustryGroup = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // lucide icon name
  gradient: string;
  children: SubIndustry[];
};

const s = (
  slug: string,
  name: string,
  tagline: string,
  description: string,
  objects: string[],
  stages: string[],
  kpis: string[],
  personas: string[],
  agents: string[],
  faq: Array<{ q: string; a: string }>,
  extra: Partial<SubIndustry> = {},
): SubIndustry => ({ slug, name, tagline, description, objects, stages, kpis, personas, agents, faq, ...extra });

export const INDUSTRY_GROUPS: IndustryGroup[] = [
  {
    slug: "financial-services",
    name: "Financial Services",
    tagline: "Acquisition, onboarding and compliance in one lending-grade CRM.",
    description:
      "KYC/KYB, bureau checks, eligibility, DSA and branch distribution, payouts and AI voice follow-ups — built for regulated money businesses.",
    icon: "Landmark",
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6 50%,#ec4899)",
    children: [
      s("fintech", "Fintech", "Digital-first acquisition with verification built in.",
        "Run digital onboarding journeys with PAN, GST, bank and bureau verification wired straight into the pipeline.",
        ["Leads", "Customers", "Applications", "Products", "Deals", "Documents", "Verification", "Tickets"],
        ["New", "Contacted", "Qualified", "Application", "Verification", "Underwriting", "Approved", "Activated"],
        ["Activation rate", "Drop-off by step", "CAC per channel", "Time to activate"],
        ["Growth leads", "Risk & compliance", "Support"],
        ["Lead qualification agent", "KYC nudge agent", "WhatsApp onboarding agent"],
        [{ q: "Can verification run automatically?", a: "Yes — DigiVerify steps run inside DigiFlow the moment a lead is created." }],
        { live: true, liveHref: "/fintech", aliases: ["fintech-dsa"] }),
      s("lending", "Lending / NBFC", "Loan pipelines, KYC and payouts on one screen.",
        "A full loan origination workflow for DSAs, NBFCs and brokers: multi-lender routing, document collection, sanction tracking and commission payouts.",
        ["Leads", "Applications", "Lenders", "Products", "Documents", "DSA Partners", "Payouts", "Tasks"],
        ["Lead", "Docs Pending", "Docs Collected", "Login", "Under Review", "Sanctioned", "Disbursed"],
        ["Sanction rate", "Disbursal rate", "Avg turnaround", "Expected vs received payout"],
        ["DSA owners", "Loan officers", "Credit ops"],
        ["Eligibility agent", "Document chase agent", "Lender-match agent"],
        [{ q: "Which loan products are supported?", a: "Personal, business, home, LAP, auto, education and gold — configurable per lender." }],
        { live: true, liveHref: "/fintech", aliases: ["fintech-dsa"] }),
      s("banking", "Banking", "Branch, RM and product cross-sell in one CRM.",
        "Give branches and relationship managers a single view of the customer, with lead routing, service requests and cross-sell campaigns.",
        ["Leads", "Customers", "Branches", "Relationship Managers", "Products", "Service Requests", "Campaigns"],
        ["Lead", "Contacted", "Branch Assigned", "KYC", "Account Opened", "Funded", "Cross-sell"],
        ["Accounts opened", "Branch productivity", "Cross-sell ratio", "Service SLA"],
        ["Branch managers", "RMs", "Product heads"],
        ["Cross-sell agent", "Service triage agent"],
        [{ q: "Can we scope data by branch?", a: "Yes — territories and branch-level roles isolate data automatically." }]),
      s("insurance", "Insurance", "Policies, renewals and claims under one roof.",
        "Multi-carrier quoting, policy issuance, renewal automation and claims workflows with a commission ledger per carrier.",
        ["Leads", "Customers", "Policies", "Carriers", "Quotes", "Renewals", "Claims", "Commissions"],
        ["Quote", "Proposal", "Issued", "Active", "Renewal Due", "Renewed"],
        ["Policies issued", "Renewal rate", "Claims TAT", "Commission earned"],
        ["Brokers", "Renewal desk", "Claims managers"],
        ["Renewal reminder agent", "Quote comparison agent"],
        [{ q: "Multiple lines of business?", a: "Life, motor, health and commercial each get their own pipeline template." }],
        { aliases: ["insurance"] }),
      s("wealth-investment", "Wealth & Investment", "Advisors, portfolios and reviews.",
        "Track prospects, onboarding, risk profiling, SIP mandates and periodic portfolio reviews with compliance-safe audit trails.",
        ["Prospects", "Clients", "Portfolios", "Products", "Mandates", "Reviews", "Documents"],
        ["Prospect", "Discovery", "Risk Profile", "Proposal", "Onboarded", "Invested", "Review"],
        ["AUM added", "Client retention", "SIP mandates", "Review compliance"],
        ["Advisors", "Compliance", "Ops"],
        ["Portfolio review agent", "Nudge agent"],
        [{ q: "Do you support family grouping?", a: "Yes — households roll up portfolios across members." }]),
      s("broking", "Broking", "Account opening to active trading.",
        "Convert leads into funded trading accounts with e-KYC, activation nudges and dealer-desk service workflows.",
        ["Leads", "Clients", "Accounts", "Segments", "Documents", "Tickets", "Campaigns"],
        ["Lead", "Contacted", "eKYC", "Account Opened", "Funded", "First Trade", "Active"],
        ["Accounts opened", "Funding rate", "First-trade conversion", "Churn"],
        ["Acquisition heads", "Dealers", "Support"],
        ["Activation agent", "Reactivation agent"],
        [{ q: "Can we track dormant clients?", a: "Yes — inactivity triggers reactivation journeys in DigiFlow." }]),
      s("payments", "Payments", "Merchant acquisition and onboarding.",
        "Acquire merchants, run KYB and bank verification, and track go-live and transaction activation across sales and partner channels.",
        ["Leads", "Merchants", "Partners", "Products", "KYB", "Documents", "Tickets"],
        ["Lead", "Qualified", "KYB", "Underwriting", "Onboarded", "Go-Live", "Transacting"],
        ["Merchants onboarded", "Time to go-live", "Activation rate", "GTV per merchant"],
        ["Sales heads", "Risk", "Partner managers"],
        ["KYB agent", "Activation agent"],
        [{ q: "Do you verify business documents?", a: "DigiVerify covers GST, Udyam, PAN and bank penny-drop checks." }]),
    ],
  },
  {
    slug: "property",
    name: "Property",
    tagline: "Inventory, site visits and bookings from first enquiry to registry.",
    description:
      "Real estate sales, construction projects and property management on one platform — with channel partners, payments and documents built in.",
    icon: "Building2",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444 60%,#ec4899)",
    children: [
      s("real-estate", "Real Estate", "Match buyers to inventory in minutes.",
        "Property inventory, buyer matching, site-visit scheduling, channel-partner management and booking-to-registration tracking.",
        ["Leads", "Properties", "Projects", "Inventory", "Site Visits", "Brokers", "Channel Partners", "Bookings", "Payments", "Commissions"],
        ["New Lead", "Contacted", "Qualified", "Site Visit", "Interested", "Negotiation", "Booking", "Agreement", "Registered"],
        ["Site visits", "Visit → close", "Avg ticket size", "GMV closed"],
        ["Agency owners", "Sales agents", "Channel partner managers"],
        ["Inventory match agent", "Site-visit reminder agent"],
        [{ q: "Rentals and resale together?", a: "Yes — property types and stages are fully configurable." }],
        { live: true, liveHref: "/realestate", aliases: ["real-estate"] }),
      s("construction", "Construction", "Estimates, BOQs and contracts that stay on track.",
        "Track enquiries through site survey, estimate, BOQ, quotation and contract, then run the delivery project with vendors and materials.",
        ["Leads", "Projects", "Sites", "Contractors", "Vendors", "Estimates", "BOQ", "Quotations", "Contracts", "Materials", "Payments"],
        ["Lead", "Requirement", "Site Visit", "Estimate", "Quote", "Negotiation", "Contract", "Project", "Completion"],
        ["Win rate", "Avg contract value", "Estimate turnaround", "Milestone collections"],
        ["Project heads", "Estimators", "Procurement"],
        ["BOQ drafting agent", "Follow-up agent"],
        [{ q: "Can we version estimates?", a: "Every estimate and quotation keeps full version history." }]),
      s("property-management", "Property Management", "Tenants, leases and renewals without spreadsheets.",
        "Manage units, owners, tenants, leases, rent collection, maintenance requests and renewals in one operational workspace.",
        ["Properties", "Units", "Owners", "Tenants", "Leases", "Rent", "Maintenance", "Complaints", "Vendors", "Inspections", "Renewals"],
        ["Inquiry", "Property Match", "Visit", "Application", "Verification", "Lease", "Move-in", "Renewal"],
        ["Occupancy", "Rent collected", "Renewal rate", "Maintenance SLA"],
        ["Portfolio managers", "Facility teams", "Owners"],
        ["Rent reminder agent", "Maintenance triage agent"],
        [{ q: "Do owners get their own view?", a: "Yes — DigiPortal gives owners and tenants a self-service portal." }]),
    ],
  },
  {
    slug: "commerce",
    name: "Commerce",
    tagline: "Customers, orders and channel partners across every selling motion.",
    description:
      "Retail, e-commerce, consumer goods and distribution — from quote-to-cash to dealer schemes and field coverage.",
    icon: "ShoppingBag",
    gradient: "linear-gradient(135deg,#10b981,#14b8a6 60%,#06b6d4)",
    children: [
      s("retail", "Retail", "Store footfall to repeat purchase.",
        "Capture walk-ins and enquiries, run store-level pipelines, loyalty programs and campaigns that drive repeat purchase.",
        ["Customers", "Stores", "Products", "Categories", "Orders", "Returns", "Loyalty", "Campaigns", "Payments"],
        ["Lead", "Contacted", "Qualified", "Product Interest", "Quote", "Order", "Payment", "Fulfilled"],
        ["Conversion rate", "Avg basket", "Repeat rate", "Store performance"],
        ["Store managers", "Regional heads", "Marketing"],
        ["Repeat purchase agent", "Loyalty campaign agent"],
        [{ q: "Multi-store rollups?", a: "Yes — store, cluster and region hierarchies are built in." }]),
      s("ecommerce", "E-commerce", "Recover carts, retain customers.",
        "Sync orders and customers, recover abandoned carts, run segmentation and churn prediction, and support shoppers with an AI assistant.",
        ["Customers", "Products", "Orders", "Cart", "Abandoned Cart", "Returns", "Refunds", "Coupons", "Campaigns", "Support"],
        ["Visitor", "Lead", "Cart", "Abandoned", "Recovered", "Ordered", "Delivered", "Repeat"],
        ["Cart recovery rate", "Repeat purchase", "LTV", "Refund rate"],
        ["Growth managers", "CX leads", "Ops"],
        ["Abandoned-cart agent", "Product recommendation agent", "AI shopping assistant"],
        [{ q: "Can it predict churn?", a: "Yes — RFM-based segments feed churn journeys automatically." }]),
      s("consumer-goods", "Consumer Goods", "Distributor and retailer coverage that sticks.",
        "Manage distributors, dealers and retailers with SKU-level ordering, schemes, promotions and field-rep visit tracking.",
        ["Distributors", "Dealers", "Retailers", "Products", "SKUs", "Orders", "Schemes", "Promotions", "Field Visits", "Sales Reps"],
        ["Prospect", "Onboarded", "First Order", "Repeat", "Scheme Active", "Growth"],
        ["Coverage %", "Order frequency", "Scheme ROI", "Rep productivity"],
        ["Sales heads", "Field reps", "Trade marketing"],
        ["Beat-plan agent", "Order nudge agent"],
        [{ q: "Do reps work offline?", a: "Field visits sync when connectivity returns." }]),
      s("distribution", "Distribution", "Territories, credit and collections in view.",
        "Run a distribution network with territory mapping, inventory visibility, credit limits, collections and channel schemes.",
        ["Dealers", "Distributors", "Retailers", "Territories", "Products", "Orders", "Inventory", "Schemes", "Credit", "Collections"],
        ["Lead", "Appointed", "Stocked", "Ordering", "Credit Active", "Collected"],
        ["Secondary sales", "Outstanding", "Collection days", "Territory growth"],
        ["Channel heads", "Credit control", "ASMs"],
        ["Collections agent", "Territory coverage agent"],
        [{ q: "Can we enforce credit limits?", a: "Orders beyond limit route to approval in DigiFlow." }]),
    ],
  },
  {
    slug: "mobility-supply-chain",
    name: "Mobility & Supply Chain",
    tagline: "Quotes, bookings and fleet operations end to end.",
    description:
      "Logistics, transportation, automotive dealerships and travel — rate quoting, bookings, delivery and after-sales in one platform.",
    icon: "Truck",
    gradient: "linear-gradient(135deg,#0ea5e9,#3b82f6 60%,#6366f1)",
    children: [
      s("logistics", "Logistics", "Rate to delivery, tracked.",
        "Quote freight, convert bookings, assign routes and carriers, and keep customers updated until proof of delivery and invoicing.",
        ["Customers", "Shipments", "Bookings", "Routes", "Vehicles", "Drivers", "Carriers", "Warehouses", "Tracking", "Invoices", "Tickets"],
        ["Lead", "Requirement", "Rate", "Quote", "Booking", "Pickup", "Transit", "Delivered", "Closed"],
        ["Quote win rate", "On-time delivery", "Revenue per shipment", "Days to invoice"],
        ["Sales", "Ops controllers", "Finance"],
        ["Rate quoting agent", "Delivery status agent"],
        [{ q: "Can customers track shipments?", a: "Yes — DigiPortal exposes live status without login sprawl." }]),
      s("transportation", "Transportation", "Fleet, trips and costs under control.",
        "Manage fleet, drivers, trips and bookings with maintenance schedules, fuel and expense tracking and document compliance.",
        ["Fleet", "Drivers", "Vehicles", "Routes", "Trips", "Bookings", "Customers", "Maintenance", "Fuel", "Expenses", "Documents"],
        ["Enquiry", "Quote", "Confirmed", "Assigned", "In Trip", "Completed", "Invoiced"],
        ["Fleet utilisation", "Cost per km", "Trip margin", "Compliance expiry"],
        ["Fleet owners", "Dispatchers", "Finance"],
        ["Maintenance reminder agent", "Trip assignment agent"],
        [{ q: "Do you track document expiry?", a: "Permits, insurance and fitness expiries trigger alerts." }]),
      s("automotive", "Automotive", "Enquiry, test drive, delivery, renewal.",
        "A dealership workspace covering model enquiries, test drives, trade-ins, finance and insurance attach, delivery and service renewals.",
        ["Vehicle Leads", "Models", "Inventory", "Test Drives", "Dealerships", "Sales Executives", "Trade-ins", "Finance", "Insurance", "Bookings", "Delivery", "Service", "Renewals"],
        ["New Lead", "Contacted", "Qualified", "Test Drive", "Negotiation", "Finance", "Booking", "Delivery", "Service"],
        ["Test-drive conversion", "Finance attach", "Delivery TAT", "Service retention"],
        ["Showroom managers", "Sales advisors", "Finance desk"],
        ["Test-drive booking agent", "Service renewal agent"],
        [{ q: "Pre-owned inventory?", a: "New and pre-owned share the same inventory model." }],
        { aliases: ["automotive"] }),
      s("travel-hospitality", "Travel & Hospitality", "Itineraries, quotes and bookings.",
        "Build itineraries, quote packages, collect deposits and manage supplier bookings and traveller documents through post-trip reviews.",
        ["Travellers", "Leads", "Destinations", "Packages", "Itineraries", "Hotels", "Flights", "Activities", "Quotations", "Bookings", "Suppliers", "Payments", "Visa/Documents"],
        ["Inquiry", "Requirement", "Package", "Quote", "Negotiation", "Booking", "Payment", "Travel", "Post-Trip"],
        ["Quote conversion", "Avg trip value", "Deposit collection", "Repeat travellers"],
        ["Travel consultants", "Ops", "Owners"],
        ["Itinerary drafting agent", "Deposit reminder agent"],
        [{ q: "Multi-currency quotes?", a: "Yes — quotes support multiple currencies and supplier costs." }],
        { aliases: ["travel"] }),
    ],
  },
  {
    slug: "healthcare",
    name: "Healthcare",
    tagline: "Patient acquisition, intake and follow-up without no-shows.",
    description:
      "Hospitals, clinics, diagnostics and healthtech — enquiry routing, appointments, referrals and adherence follow-ups with audit-ready logs.",
    icon: "Stethoscope",
    gradient: "linear-gradient(135deg,#14b8a6,#0ea5e9 60%,#6366f1)",
    children: [
      s("hospitals", "Hospitals", "Enquiry to admission, department-wise.",
        "Route patient enquiries to the right department, manage referrals, admissions, TPA/insurance coordination and post-discharge follow-up.",
        ["Patients", "Doctors", "Departments", "Appointments", "Admissions", "Enquiries", "Referrals", "Insurance/TPA", "Billing", "Follow-ups", "Feedback"],
        ["Enquiry", "Triage", "Consult Booked", "Consulted", "Advised Admission", "Admitted", "Discharged", "Follow-up"],
        ["Enquiry → consult", "No-show rate", "Referral share", "Follow-up compliance"],
        ["Hospital marketing", "Front desk", "Department heads"],
        ["Enquiry triage agent", "No-show reduction agent"],
        [{ q: "Multi-unit hospital groups?", a: "Each unit is isolated with its own roles and dashboards." }],
        { aliases: ["healthcare-clinics"] }),
      s("clinics", "Clinics", "Appointments, packages and reviews.",
        "Small-format clinics get appointment booking, treatment packages, payments, recalls and review generation in one place.",
        ["Patients", "Doctors", "Appointments", "Treatments", "Follow-ups", "Packages", "Payments", "Reviews"],
        ["Enquiry", "Booked", "Visited", "Treatment Plan", "In Treatment", "Completed", "Recall"],
        ["Booking rate", "Show-up rate", "Package uptake", "Review score"],
        ["Clinic owners", "Front desk", "Doctors"],
        ["Recall agent", "Review request agent"],
        [{ q: "WhatsApp reminders?", a: "Yes — appointment reminders go out on WhatsApp automatically." }],
        { aliases: ["healthcare-clinics"] }),
      s("diagnostics", "Diagnostics", "Lab bookings and home collection.",
        "Manage test enquiries, package selection, home-collection scheduling, report delivery and doctor referral tracking.",
        ["Leads", "Patients", "Tests", "Packages", "Lab Bookings", "Home Collection", "Reports", "Referrals"],
        ["Enquiry", "Package Selected", "Booked", "Sample Collected", "Processing", "Report Ready", "Repeat"],
        ["Booking conversion", "Home-collection SLA", "Report TAT", "Referral revenue"],
        ["Lab managers", "Phlebotomy ops", "Referral desk"],
        ["Slot booking agent", "Report delivery agent"],
        [{ q: "Do you track referring doctors?", a: "Yes — referral share and payouts are tracked per doctor." }]),
      s("healthtech", "HealthTech", "Subscriptions, care plans and engagement.",
        "Digital health products get lead capture, provider onboarding, plan subscriptions, care-team scheduling and engagement analytics.",
        ["Leads", "Patients", "Providers", "Plans", "Subscriptions", "Appointments", "Support", "Engagement"],
        ["Lead", "Trial", "Assessment", "Plan Selected", "Subscribed", "Engaged", "Renewed"],
        ["Trial → paid", "Retention", "Engagement score", "Support CSAT"],
        ["Growth", "Care ops", "Support"],
        ["Onboarding agent", "Adherence agent"],
        [{ q: "Can care teams collaborate?", a: "Care teams share tasks, notes and timelines per patient." }]),
    ],
  },
  {
    slug: "education",
    name: "Education",
    tagline: "Enquiry to enrolment, counsellor by counsellor.",
    description:
      "Higher education, edtech, coaching and career training — admissions pipelines, counselling, applications, fees and renewals.",
    icon: "GraduationCap",
    gradient: "linear-gradient(135deg,#f97316,#f59e0b 60%,#eab308)",
    children: [
      s("higher-education", "Higher Education", "Applications, documents, admissions.",
        "Manage student enquiries across programs and campuses with counselling, document verification, admission decisions and fee tracking.",
        ["Student Leads", "Courses", "Colleges", "Applications", "Counselling", "Documents", "Admissions", "Fees", "Scholarships", "Follow-ups"],
        ["New Enquiry", "Contacted", "Counselling", "Course Selected", "Application", "Documents", "Admission", "Fee Paid", "Enrolled"],
        ["Application rate", "Enquiry → enrolment", "Counsellor productivity", "Fee realisation"],
        ["Admissions officers", "Counsellors", "Academic heads"],
        ["Counselling follow-up agent", "Document chase agent"],
        [{ q: "Bulk campaign imports?", a: "CSV import with column mapping handles campaign leads." }],
        { aliases: ["education"] }),
      s("edtech", "EdTech", "Demo class to paid enrolment.",
        "Track leads through demo classes, counsellor calls, batch selection, payment and subscription renewal with engagement scoring.",
        ["Leads", "Students", "Courses", "Counsellors", "Batches", "Demo Classes", "Enrolments", "Subscriptions", "Payments", "Engagement"],
        ["Lead", "Contacted", "Demo Booked", "Demo Attended", "Counselled", "Enrolled", "Paid", "Renewed"],
        ["Demo attendance", "Demo → paid", "Renewal rate", "Revenue per counsellor"],
        ["Growth", "Counsellors", "Academic ops"],
        ["Demo reminder agent", "Renewal agent"],
        [{ q: "Do you score lead intent?", a: "Yes — AI qualification scores intent from activity and calls." }],
        { aliases: ["education"] }),
      s("coaching", "Coaching", "Batches, attendance and fee cycles.",
        "Coaching institutes manage enquiries, batch capacity, admissions, instalment fee cycles and parent communication.",
        ["Enquiries", "Students", "Parents", "Batches", "Faculty", "Attendance", "Tests", "Fees", "Instalments"],
        ["Enquiry", "Counselling", "Trial Class", "Admission", "Batch Assigned", "Fee Paid", "Active"],
        ["Admission rate", "Batch fill", "Fee collection", "Dropout rate"],
        ["Centre heads", "Counsellors", "Accounts"],
        ["Fee reminder agent", "Attendance alert agent"],
        [{ q: "Do parents get updates?", a: "Parents receive WhatsApp updates on attendance and fees." }]),
      s("career-training", "Career & Training", "Placement-linked programs, tracked.",
        "Skilling and certification providers manage cohorts, employer partners, placements and outcome reporting alongside the sales pipeline.",
        ["Leads", "Learners", "Programs", "Cohorts", "Trainers", "Assessments", "Placements", "Employers", "Payments"],
        ["Enquiry", "Counselled", "Assessment", "Enrolled", "In Training", "Certified", "Placed"],
        ["Enrolment rate", "Completion rate", "Placement rate", "Avg package"],
        ["Program heads", "Placement teams", "Trainers"],
        ["Cohort nudge agent", "Placement match agent"],
        [{ q: "Can we report outcomes?", a: "Placement and completion reporting is built into the pack." }]),
    ],
  },
  {
    slug: "industrial",
    name: "Industrial",
    tagline: "RFQs, long cycles, dealers and after-sales service.",
    description:
      "Manufacturing, energy, engineering and B2B services — technical quotations, multi-approver deals, dispatch, warranty and collections.",
    icon: "Factory",
    gradient: "linear-gradient(135deg,#64748b,#475569 60%,#334155)",
    children: [
      s("manufacturing", "Manufacturing", "Dealer performance and RFQ-driven sales.",
        "Manage dealers and distributors alongside RFQs, technical quotations, production handoff, dispatch, warranty and collections.",
        ["Leads", "Dealers", "Distributors", "Products", "RFQ", "Quotations", "Orders", "Production", "Dispatch", "Service", "Warranty", "Collections"],
        ["Enquiry", "RFQ", "Sample", "Quote", "Negotiation", "PO", "Production", "Dispatched", "Collected"],
        ["Quote win rate", "Dealer productivity", "Order-to-dispatch", "Receivable days"],
        ["BD managers", "Application engineers", "Channel heads"],
        ["RFQ drafting agent", "Dealer coverage agent"],
        [{ q: "ERP integration?", a: "Webhook and CSV bridges sync orders and dispatch with your ERP." }],
        { aliases: ["manufacturing"] }),
      s("energy", "Energy", "Site survey to commissioning and AMC.",
        "Solar and energy businesses run site surveys, load assessment, proposals, installation projects, commissioning and AMC renewals.",
        ["Leads", "Sites", "Energy Requirements", "Site Surveys", "Products", "Proposals", "Projects", "Installation", "Commissioning", "AMC", "Service", "Payments"],
        ["Lead", "Survey", "Design", "Proposal", "Negotiation", "Order", "Installation", "Commissioned", "AMC"],
        ["Survey → order", "Avg system size", "Installation TAT", "AMC renewals"],
        ["Sales engineers", "Project managers", "Service"],
        ["Savings estimate agent", "AMC renewal agent"],
        [{ q: "Subsidy paperwork?", a: "Document workflows track subsidy and net-metering filings." }]),
      s("engineering", "Engineering", "Technical selling with approvals.",
        "Engineering firms manage specification-led enquiries, technical submittals, multi-approver quotations and project handover.",
        ["Leads", "Clients", "Specifications", "Submittals", "Quotations", "Approvals", "Projects", "Vendors", "Documents"],
        ["Enquiry", "Specification", "Submittal", "Quote", "Approval", "Order", "Execution", "Handover"],
        ["Spec-in rate", "Approval cycle time", "Win rate", "Project margin"],
        ["BD", "Design engineers", "PMO"],
        ["Submittal drafting agent", "Approval chase agent"],
        [{ q: "Multi-approver deals?", a: "Approval chains are configured per deal value in DigiFlow." }]),
      s("b2b-services", "B2B Services", "Contracts, renewals and account growth.",
        "Service businesses selling to enterprises manage opportunities, contracts, SLAs, renewals and account expansion.",
        ["Leads", "Accounts", "Opportunities", "Contracts", "SLAs", "Renewals", "Tickets", "Invoices"],
        ["Lead", "Discovery", "Proposal", "Negotiation", "Contract", "Delivery", "Renewal"],
        ["Win rate", "Contract value", "Renewal rate", "Net revenue retention"],
        ["Account managers", "Delivery leads", "Finance"],
        ["Renewal risk agent", "QBR prep agent"],
        [{ q: "Do you track SLA breaches?", a: "SLA policies raise escalations before breach." }]),
    ],
  },
  {
    slug: "professional-services",
    name: "Professional Services",
    tagline: "Proposals, projects, timesheets and billing.",
    description:
      "Consulting firms, agencies, legal practices, IT services and staffing — from pipeline to delivery, utilisation and invoicing.",
    icon: "Briefcase",
    gradient: "linear-gradient(135deg,#06b6d4,#3b82f6 60%,#6366f1)",
    children: [
      s("consulting", "Consulting", "Proposals to engagements, with utilisation.",
        "Track opportunities, scope proposals, staff consultants, log timesheets and bill engagements without leaving the CRM.",
        ["Leads", "Clients", "Opportunities", "Projects", "Consultants", "Proposals", "Contracts", "Timesheets", "Billing", "Documents"],
        ["Lead", "Discovery", "Proposal", "Negotiation", "Signed", "Delivery", "Invoiced", "Closed"],
        ["Win rate", "Utilisation", "Realised rate", "Days to invoice"],
        ["Partners", "Engagement managers", "Finance"],
        ["Proposal drafting agent", "Staffing agent"],
        [{ q: "Timesheets to invoices?", a: "Approved timesheets roll into invoices automatically." }]),
      s("agencies", "Agencies", "Retainers, briefs and campaign delivery.",
        "Creative and marketing agencies manage new business, briefs, retainers, deliverables and client approvals in one pipeline.",
        ["Leads", "Clients", "Briefs", "Retainers", "Campaigns", "Deliverables", "Approvals", "Invoices"],
        ["Lead", "Brief", "Pitch", "Proposal", "Won", "In Delivery", "Approved", "Invoiced"],
        ["Pitch win rate", "Retainer value", "Delivery on time", "Client NPS"],
        ["New business", "Account directors", "Delivery"],
        ["Pitch deck agent", "Client update agent"],
        [{ q: "Client approvals?", a: "DigiPortal collects approvals and feedback from clients." }]),
      s("legal", "Legal", "Matters, retainers and compliance.",
        "Law firms manage enquiries, conflict checks, matters, hearings, documents, retainers and time-based billing.",
        ["Enquiries", "Clients", "Matters", "Hearings", "Documents", "Retainers", "Timesheets", "Invoices", "Compliance"],
        ["Enquiry", "Conflict Check", "Consultation", "Engagement Letter", "Matter Open", "In Progress", "Closed"],
        ["Engagement rate", "Billable hours", "Realisation", "Matter cycle time"],
        ["Partners", "Associates", "Practice managers"],
        ["Intake agent", "Hearing reminder agent"],
        [{ q: "Is client data isolated?", a: "Matter-level access control restricts data to the assigned team." }]),
      s("it-services", "IT Services", "From RFP to renewal on one platform.",
        "Convert deals into projects, run SLA-aware tickets, and give account managers real-time delivery health and utilisation.",
        ["Leads", "Clients", "Opportunities", "Projects", "Tickets", "SLAs", "Consultants", "Timesheets", "Invoices"],
        ["Discovery", "Proposal", "Signed", "Delivery", "UAT", "Live", "Renewal"],
        ["Win rate", "Delivery health", "Ticket SLA", "Utilisation"],
        ["Account managers", "Delivery leads", "Support engineers"],
        ["Ticket triage agent", "Renewal agent"],
        [{ q: "SLA routing?", a: "Automation rules pick priority owners and escalate on breach." }],
        { live: true, liveHref: "/it", aliases: ["it-company"] }),
      s("staffing", "Staffing", "Requisitions, candidates and placements.",
        "Staffing and recruitment firms track client requisitions, candidate pipelines, submissions, interviews and placements.",
        ["Clients", "Requisitions", "Candidates", "Submissions", "Interviews", "Offers", "Placements", "Invoices"],
        ["Requisition", "Sourcing", "Submitted", "Interview", "Offer", "Joined", "Invoiced"],
        ["Fill rate", "Time to fill", "Submission → interview", "Placement margin"],
        ["Delivery heads", "Recruiters", "Account managers"],
        ["Candidate match agent", "Interview scheduling agent"],
        [{ q: "Do you dedupe candidates?", a: "Candidate records dedupe on email and phone at intake." }]),
    ],
  },
];

export const ALL_SUB_INDUSTRIES: Array<SubIndustry & { group: IndustryGroup }> = INDUSTRY_GROUPS.flatMap(
  (g) => g.children.map((c) => ({ ...c, group: g })),
);

export function getGroup(slug: string) {
  return INDUSTRY_GROUPS.find((g) => g.slug === slug);
}

export function getSubIndustry(groupSlug: string, slug: string) {
  const group = getGroup(groupSlug);
  if (!group) return undefined;
  const sub = group.children.find((c) => c.slug === slug);
  return sub ? { group, sub } : undefined;
}

/** Resolve a legacy /industries/<slug> value to its new nested path. */
export function resolveLegacySlug(slug: string): { group: string; slug: string } | undefined {
  for (const g of INDUSTRY_GROUPS) {
    for (const c of g.children) {
      if (c.slug === slug || c.aliases?.includes(slug)) return { group: g.slug, slug: c.slug };
    }
  }
  return undefined;
}

export function industryPath(groupSlug: string, slug: string) {
  return `/industries/${groupSlug}/${slug}`;
}
