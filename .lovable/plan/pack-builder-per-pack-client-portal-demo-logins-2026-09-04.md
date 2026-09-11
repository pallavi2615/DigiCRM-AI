# Pack builder, per-pack client portal, demo logins

Three pieces: create packs without code, give clients a per-pack portal, and cover every industry group and product with a demo login plus real data.

## 1. Pack builder under /admin

Today `/admin-packs` can only override the 26 built-in packs. The storage table now has the extra columns (name, tagline, description, gradient, KPI labels, verifications, lost stages, custom flag, archived) — the UI does not use them yet.

- "New pack" flow: pick an industry group, name and tagline, set record / party / value wording, choose which verification checks apply, pick KPI labels.
- Stage editor: add, rename, reorder (move up/down) and mark stages as won or lost.
- Field editor: text, number, date, select, currency, with required flag and option list for selects.
- AI agent editor: name, purpose and prompt per agent.
- Duplicate any existing pack as a starting point; archive a custom pack (records kept, pack hidden) and delete a draft.
- Custom packs then appear everywhere built-in packs do: pack registry, `/packs`, the workspace route, admin module toggles, the AI agent runner and the portal.
- Seed three custom packs with real records, documents and payments so their funnels and KPIs show live numbers.

## 2. Per-pack client portal

- Public route per pack at `/portal/$group/$slug`: pack overview, what the pack asks for, and an application form built from the pack's own fields (so custom packs work too). Submitting creates a record in the first stage owned by the signer's email.
- Signed-out visitors get a sign-in / sign-up card on the same page and return to the form after auth.
- Client dashboard `/portal` (existing) gains a pack switcher listing every pack the client has a record in, plus an "Apply to another pack" launcher.
- Per-application view: stage tracker using the pack's own stage names, document list with upload into the private attachments bucket, status per document (pending / uploaded / verified / rejected), and a read-only payments/fees tab.
- Clients only ever see their own records, documents and payments; staff visibility is unchanged.

## 3. Demo logins and wiring every industry and product

- One demo login per industry group (8) plus a demo client login, alongside the four existing role logins. Each industry login lands on its own pack workspace.
- Seed records, documents and payments for any group that currently has none so every funnel and KPI renders live numbers.
- Show demo logins on the sign-in page as one-click chips, grouped by role vs industry.
- Product layer: make sure each product page (DigiCRM, DigiMarketing, DigiSales, DigiService, DigiAI, DigiFlow, DigiVerify, DigiPortal) links to its working in-app surface, and every industry page links to its pack workspace and portal — no dead links.
- End-to-end pass: sign in as each demo user, load every pack workspace, submit a portal application, upload a document, move it through stages, and confirm nothing 404s or errors.

## Technical notes

- `mergePack` gains the ability to build a pack from a `pack_configs` row with no built-in base (custom packs), keyed on `is_custom`; the registry read path becomes a hook that returns built-ins plus custom rows.
- Portal apply route is public (SSR on, no auth gate); the submit action runs through an authenticated server function so RLS sets `created_by`/`owner_id` correctly with `contact_email` set to the signed-in user's email.
- Uploads go to the existing private `attachments` bucket under a client-scoped path with signed URLs for read-back.
- Demo users are created via the admin API in a seeding script, not from client code; seeded rows go in as literal data.
