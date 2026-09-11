# Industry-locked access, a real client pack portal, and portal payments

## What you get

1. Partners and clients choose their industry when they join, and from then on they only ever see that industry's CRM — menu, dashboard, records and reports. Admins can change someone's industry later.
2. Every industry CRM opens with the same full set of tabs, each as its own page: Leads, Pipeline, Contacts, Companies, Tasks, Meetings, Calendar, Reports, Documents, Payments, Tickets — all showing only that industry's data.
3. A proper client pack portal: clients apply to a pack, upload their documents, watch DigiVerify results come back, and follow their application through the five stages.
4. A payments page in the client portal where a client records their pack fee payment (bank transfer, UPI or cheque with a reference). Staff confirm it, and the confirmed amount flows straight into that workspace's billing totals.

## 1. Industry selection and lock-in

- Onboarding gains a required industry step for anyone signing up as a partner or client. The choice is saved against their account.
- New signups without an industry land on a short "choose your industry" screen instead of an empty dashboard.
- Admins can reassign a person's industry from Settings, exactly as they do today for staff.
- Someone tied to one industry no longer sees the industry switcher, and typing another industry's web address is refused by the server, not just hidden in the menu.
- Templates, packs and portals offered to a partner or client are filtered to their industry.

## 2. Consistent tabs on every industry CRM

- One shared industry workspace shell renders a tab bar with the same eleven tabs for every industry, so Healthcare looks and works like Fintech.
- Each tab is a real page with its own web address so it can be bookmarked and shared.
- Existing purpose-built pages (fintech applications, real-estate properties, IT projects, product orders) stay and appear as extra tabs on those industries.
- Every tab's data is filtered to the active industry, and tabs a person lacks permission for are hidden and blocked server-side.

## 3. Client pack portal

- A pack portal a client can reach without staff help: pick the pack they qualify for, fill in the pack's own fields, and submit an application.
- Documents tab: upload each required document for their pack, see what is still missing, and see review status per file.
- DigiVerify tab: live PAN / Aadhaar / GST / bank / bureau results for their own application only.
- Stage tracker: application received → documents submitted → under review → approved → completed, driven by the real record, with a clear message if it is declined.
- A client only ever sees their own applications.

## 4. Payments page in the client portal

- A Payments tab listing the pack fee and any other charges: amount, due date, status.
- "I've paid" flow: the client selects bank transfer, UPI or cheque, enters the reference and date, and submits. The charge moves to "awaiting confirmation".
- Staff see pending confirmations in the workspace and mark them received or rejected with a note.
- Confirmed payments count towards the workspace's revenue on the tenant billing page, alongside the existing affiliate payout figures.

## Technical notes

- Access: reuse `user_industry_access` + `useIndustryAccess` / `useActiveIndustry`. Add an onboarding write path and admin reassignment. Add server-side enforcement in the industry route guard and in the server functions that read leads/records, so the group filter is applied from the caller's assignment rather than from a browser value.
- Tabs: extract a shared `IndustryWorkspaceTabs` component; add missing child routes under the existing `industry.$slug` / `fintech` / `realestate` / `it` / `productsales` route families, each wrapped by the existing `IndustryGuard`.
- Client portal: build on `pack_records`, `pack_documents`, `verifications`, `pack_payments` and `ClientStageTracker`. Add a public/self-serve apply flow feeding `pack_records` with `contact_email` set to the signed-in user.
- Payments: extend `pack_payments` with the client-submitted method, reference, submitted date and a `pending_confirmation` status; RLS lets a client insert/update only their own record's payment claims and staff confirm. Tenant billing aggregates rows with status `paid`.
- No payment gateway is added — payments are recorded manually, matching how partner payouts already work.
