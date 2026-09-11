# DigiCRM AI — Platform + Industry Pack Architecture

Restructure DigiCRM AI from "a CRM with a few industry dashboards" into a layered platform: product suite (Sales / Marketing / Service / AI / Flow / Verify / Portal) with industry packs configured on top. Delivered in phases; site layer first, then the engine, then the new modules.

## Phase 1 — Site & positioning layer

**Industry taxonomy**: replace the flat 10-entry list in `src/lib/industries.ts` with a two-level registry: 8 groups and their sub-industries.

```text
Financial Services  Fintech · Lending · Banking · Insurance · Wealth · Broking · Payments
Property            Real Estate · Construction · Property Management
Commerce            Retail · E-commerce · Consumer Goods · Distribution
Mobility & Supply   Logistics · Transportation · Automotive · Travel & Hospitality
Healthcare          Hospitals · Clinics · Diagnostics · HealthTech
Education           Higher Education · EdTech · Coaching · Career & Training
Industrial          Manufacturing · Energy · Engineering · B2B Services
Professional Svcs   Consulting · Agencies · Legal · IT Services · Staffing
```

Each sub-industry entry carries: name, tagline, description, objects/modules list, pipeline stages, personas, KPIs, FAQ, gradient, icon, live flag.

**Pages**
- `/industries` — grouped index (8 group cards, sub-industry chips).
- `/industries/$group` — group overview page listing its sub-industries.
- `/industries/$group/$slug` — sub-industry landing page (hero, objects, pipeline diagram, KPIs, AI agents, FAQ, CTA). Replaces today's single `industries.$slug.tsx`.
- `/products` plus one page each for DigiCRM, DigiMarketing, DigiSales, DigiService, DigiAI, DigiFlow, DigiVerify, DigiPortal.
- Header/footer mega-menu driven by the same registry.
- Old `/industries/$slug` URLs redirect to the new nested paths (published site — no dead links).
- Per-route `head()` metadata via the existing `buildRouteMeta` helper.

## Phase 2 — Industry pack engine (in-app)

A single configurable workspace replaces bespoke industry pages.

**Pack definition** (`src/lib/packs/*`): per industry — terminology map (Deal → "Loan Application" / "Property Deal" / "Sales Opportunity"), record types and custom fields, pipeline stages with colours, KPI definitions, task/activity types, export columns, default automations, AI agent presets.

**Generic workspace routes** under `_authenticated`:
`/w/$pack` dashboard, `/w/$pack/records/$type`, `/w/$pack/pipeline`, `/w/$pack/reports`, `/w/$pack/settings`. Rendered by shared components (KPI grid, record table with CRUD, kanban, report builder) fed by the pack config.

**Data model**: a generic `records` table (tenant_id, pack, record_type, stage, title, value, owner_id, jsonb `fields`, timestamps) plus `record_stages`, `pack_configs` for per-tenant overrides of stages/fields/terminology. RLS mirrors the existing leads pattern: role-based via `private.has_role` plus owner scoping, with GRANTs for `authenticated` and `service_role`.

**Migration of existing workspaces**: Fintech, Real Estate, IT and Product Sales become packs. Their existing domain tables (`loan_applications`, `re_properties`, etc.) stay as specialised extension tables surfaced by pack-specific panels, so no data is lost; the list/pipeline/dashboard chrome comes from the engine. Old routes (`/fintech`, `/realestate`, `/it`, `/productsales`) redirect to their pack routes.

## Phase 3 — Product modules

- **DigiFlow** — no-code workflow builder: trigger → condition → AI decision → action → human approval. Tables `flows`, `flow_runs`, `flow_steps`; a visual builder UI; execution through server functions. Extends the existing `automation_rules`.
- **DigiVerify** — verification hub: PAN, GST, bank account, Aadhaar, Udyam, DL/RC, KYC/KYB, document OCR. Provider-agnostic adapter with a mock provider by default; live providers switch on once API keys are supplied. Tables `verifications`, `verification_providers`; results attach to any record.
- **DigiPortal** — external customer/partner/dealer portal at `/portal/$tenantSlug/...` with magic-link auth: application status, documents, tickets, payments, tasks.
- **DigiSales** — field execution: lead distribution rules, check-in/visit logging with GPS, targets and incentives, rep performance.
- **DigiMarketing** — campaigns, segments, email/WhatsApp/SMS sends, journeys, attribution, reusing existing landing pages and CMS.
- **DigiService** — regroup the existing tickets/SLA/canned responses, add knowledge base and portal-linked support.
- **DigiAI** — regroup the AI assistant and proposal generator, add lead-qualification, follow-up and WhatsApp/voice agents (text agents on Lovable AI; voice needs a provider key).

Sidebar is regrouped by product (DigiCRM / DigiSales / DigiMarketing / DigiService / DigiAI / DigiFlow / DigiVerify / DigiPortal / Industry Workspace / Admin), with plan-based gating reusing `plan_features`.

## Technical notes

- Registry-first: one typed source of truth in `src/lib/industries.ts` (taxonomy) and `src/lib/packs/` (workspace behaviour) drives menus, routes, landing pages, dashboards and exports.
- Routes follow TanStack file-based conventions; every linked path gets a route file in the same batch.
- New tables ship with GRANTs, RLS enabled and role/owner policies in the same migration; demo rows included via literal INSERTs so dashboards render populated.
- Third-party verification, WhatsApp and voice require user-supplied API keys; until then those adapters run in mock mode with clearly labelled sample results.
- Existing security posture is preserved: `private.has_role` checks, tenant scoping, audit logging on writes.

## Sequencing

1. Taxonomy + industry/product pages + navigation + redirects.
2. Pack engine schema, generic workspace, Fintech and Real Estate migrated.
3. IT and Product Sales migrated; per-tenant pack customisation in settings.
4. DigiFlow, then DigiVerify, then DigiPortal.
5. DigiSales, DigiMarketing, DigiService/DigiAI regrouping and gaps.

Each phase is shippable on its own; we start with phase 1 and check in before phase 2.
