# Fix the Fintech (DSA) and Real Estate industry dashboards

Both workspaces are already wired to the live database — Applications, Lenders, Commissions, Clients, Properties and both Kanban pipelines all read and write real data. The problems are gaps and mismatches, not stubs.

## What's actually wrong today

**Both**
- Nothing is realtime. If a second agent moves a card or edits a record, your screen keeps the stale value until you refresh.
- There is no sample data in either workspace (0 loan applications, 0 clients, 0 properties, 0 deals), so every chart and KPI renders empty and the modules look broken on first open.

**Fintech / lending DSA**
- Dashboard is missing the metrics a DSA actually runs on: sanction rate, approval-to-disbursal conversion, average turnaround time, and a stage funnel. Right now it only shows raw counts per stage.
- The Delete action on an application is shown to every user, but only administrators are allowed to delete — sales executives get a red error instead of simply not seeing the button.
- Lenders and loan products can be created and edited but never deleted or deactivated, even though admins are permitted to.
- Pipeline cards show no ageing/stuck indicator, so nothing signals an application sitting in one stage too long.
- Commissions payouts are correctly auto-created when an application is marked disbursed (verified) — that part works; it only looks broken because there is no data.

**Real estate / property agent**
- Dashboard shows only Active Properties, Clients, Deals Won and closed value. Missing: listings broken down by status (available / hold / sold / rented) and by property type, site-visit-to-deal conversion, and agent-wise closures.
- No budget matching: a client's budget range is captured but never used to surface matching inventory.
- Deals on the pipeline can only be dragged between stages — there is no way to edit or delete a deal, so a wrong value, client or property is uncorrectable from the app.
- The Delete button on a client is shown to sales managers, but the database only permits administrators to delete clients — it always fails for managers.
- Properties have no photos, despite the marketing page promising rich media.
- No CSV export on clients, properties or deals, while the fintech module has it.

## What I'll build

**1. Permission fixes (correctness first)**
- Hide the application Delete action unless the user is an admin; same for the real-estate client Delete.
- Add a Delete / Deactivate action for lenders and loan products, admin-only.

**2. Fintech dashboard upgrade**
- New KPI cards: Sanction rate, Disbursal rate, Average turnaround (login → disbursed, in days), Applications this month.
- Replace the flat stage chart with a proper funnel (New → Login → Under review → Sanctioned → Disbursed) with drop-off percentages.
- Lender-wise table: applications, sanctioned value, disbursed value, expected payout.
- Ageing badge on pipeline cards (days in current stage; amber over 7 days, red over 14).

**3. Real estate dashboard upgrade**
- New KPI cards: Listings by status, Site visits (deals in the visit stage), Visit-to-close conversion, Average ticket size.
- Listings-by-type and listings-by-status charts.
- Agent-wise closures table (deals won, closed value).
- "Matching inventory" on a client: properties whose price falls inside the client's budget range and matches the preferred city/type.

**4. Missing CRUD**
- Edit and delete a real-estate deal from the pipeline card (edit for owner/manager, delete admin-only), with client, property, expected value, stage and next action editable.
- Property photo upload into the existing private media bucket, shown as a thumbnail strip on the property card.

**5. Consistency**
- CSV export on Clients, Properties and Deals, matching the fintech pattern.
- Live sync on loan_applications, loan_commissions, re_clients, re_properties and re_deals using the existing realtime helper, so both pipelines update across users.

**6. Demo data**
- Seed a realistic set of loan applications across all stages (including disbursed ones so commissions generate), plus real-estate clients, listings and deals, so every KPI, chart and funnel is populated the moment the page opens.

## Technical notes

- Permission fixes use the existing `usePermissions` / `useAuth` helpers; `private.is_admin` covers only `super_admin` and `admin`, so admin-only delete buttons must gate on `isAdmin`, not `isManager`.
- Realtime uses the existing `useRealtimeTable` hook (already used by `/pipeline`), invalidating the relevant query keys.
- New KPIs are computed client-side from the same queries already in place — no schema changes needed, except property photos, which reuse `re_properties.images` (jsonb, already present) and the existing storage bucket + `src/lib/image-upload.ts`.
- Demo data ships as a single migration with literal INSERTs; disbursed applications will fire the existing `private.on_loan_disbursed` trigger and populate commissions automatically.
- Files touched: `fintech.index.tsx`, `fintech.applications.tsx`, `fintech.lenders.tsx`, `fintech.pipeline.tsx`, `realestate.index.tsx`, `realestate.clients.tsx`, `realestate.properties.tsx`, `realestate.pipeline.tsx`, plus one migration.
