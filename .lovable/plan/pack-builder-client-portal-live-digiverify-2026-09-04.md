# Pack builder, client portal, live DigiVerify

Four pieces of work: create packs without code, let clients apply through a pack portal, wire real verification APIs, and ship demo logins plus an end-to-end test pass.

## 1. Pack builder under /admin

Today `/admin-packs` can only override the 26 built-in packs (labels, stages, fields, agents) — the storage table has no room for a brand-new pack (no name, tagline, KPI labels, verifications or "custom" flag).

- Extend the pack storage so a row can be a full pack, not only an override: name, tagline, description, icon/gradient, KPI labels, which verification checks apply, and a custom flag.
- Add a "New pack" flow to `/admin-packs`: pick an industry group, name it, set the record/party/value wording, build the stage list (drag to reorder, mark won/lost stages), add custom fields (text, number, date, select, currency), and write the AI agent prompts.
- Custom packs appear everywhere built-in packs do: the pack registry, `/packs`, the workspace route, the admin modules toggle list, and the AI agent runner.
- Duplicate an existing pack as a starting point; archive/delete a custom pack (records are kept, pack hidden).

## 2. Pack-specific client portal

- Public sign-up: clients register with email or Google and land on the portal, no invite needed. New accounts get a client role that cannot see staff CRM screens.
- Per-pack application page: a client picks a pack, fills the pack's own fields (from the pack config, so custom packs work too), and submits — this creates a record in the first stage, owned by the client's email.
- Status view: a stage tracker for each application, with the same stage names staff see.
- Documents: the client uploads the documents the pack requires into private storage, sees status (pending / uploaded / verified / rejected), and staff can request more.
- Payments/fees tab stays read-only for clients.
- Access rules so a client only ever sees their own applications, documents and payments, and staff keep full visibility.

## 3. Live verification (DigiVerification API)

Replace the simulated bureau check and the format-only PAN/Aadhaar/GSTIN checks with real API calls to `https://api.digiverification.com/`.

- Store the partner ID and secret as backend secrets (never in code). Requests sign a short-lived HS256 JWT with `partnerId` + `timestamp` per the API docs.
- Wire PAN, GSTIN, bank account and credit bureau to the live endpoints; Aadhaar uses whatever the API exposes (OTP eKYC if available, otherwise the offline/checksum endpoint), falling back to the current checksum validation when an endpoint isn't offered or the call fails.
- Keep current privacy behaviour: raw identifiers never stored, only masked reference plus the structured live response, provider recorded as the real provider, errors surfaced clearly.
- Verification results attach to portal applications so a client's PAN/Aadhaar/GST status shows on their record.

## 4. Demo logins and end-to-end test

- One demo login per industry group (8) plus a demo client login, alongside the existing four role logins; each industry login lands on its own pack workspace with seeded records.
- Seed records, documents and payments for any group that has none, so every funnel and KPI shows live numbers.
- Show the demo logins on the sign-in page as one-click chips.
- Run a scripted end-to-end pass: sign in as each demo user, load every pack workspace, submit a client application, upload a document, move it through stages, run each verification type, and confirm nothing 404s or errors.

## Technical notes

- Pack storage: add columns to `pack_configs` (`name`, `tagline`, `description`, `gradient`, `kpi_labels`, `verifications`, `is_custom`, `archived_at`) and change the registry read path so `mergePack` can build a pack from a row with no built-in base. `PACK_GROUPS` stays the grouping key.
- Client role: new `client` value in the app role enum, RLS on `pack_records` / `pack_documents` / `pack_payments` scoped by `contact_email = auth.jwt() email` for clients; staff policies unchanged. Public routes `/portal/apply/$group/$slug` and existing `/portal` for status.
- Uploads go to the existing private `attachments` bucket under a client-scoped path.
- Verification calls live in `verify.functions.ts` (server only) with a small signed-request helper; secrets read inside the handler.
