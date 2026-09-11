# CMS, SEO and Super Admin control centre

Goal: make the marketing site fully editable from the Super Admin area, make every page SEO-correct, give Super Admin real control over users, industries and modules, and ship demo accounts plus demo data so every industry workspace can be reviewed end to end.

## Current state (verified)

- CMS admin exists at Content (CMS) with tabs: Blog, Hero, Menu, Campaigns, SEO.
- Content tables exist: pages (0 rows), posts (3), menu items (15), hero slides (3), campaigns (1), SEO settings (1).
- Pages are **not** editable anywhere and there is **no public page renderer**, although the sitemap already lists published pages.
- Header and footer read menu items but still hardcode most links, so menu edits barely change the site.
- Global SEO settings are stored but never applied (no default title/description fallback, no analytics tags, no canonical/JSON-LD from settings).
- Industry pack records table is empty, so every pack workspace renders zeros.
- There is no demo Super Admin login (only real user accounts and admin/manager/executive demo accounts).

## What will be built

### 1. Pages CMS (new)
- New "Pages" tab in Content (CMS): create/edit/publish marketing pages with slug, title, meta description, keywords, OG image, canonical override, noindex switch, hero (headline, subhead, image, CTA) and a block-based body (heading, rich text, image, feature grid, CTA, FAQ).
- Draft/Published status with preview link.
- New public route `/p/{slug}` that renders the blocks server-side with full head metadata and breadcrumb JSON-LD. Unknown or draft slugs return not-found.

### 2. Menu and footer CMS (make it real)
- Header nav and footer columns rendered entirely from menu items (footer grouped by group label), with the current links seeded as data so nothing disappears.
- Menu admin gains: header/footer split, group label, drag-free ordering (up/down), active toggle, external-link support, delete confirm.

### 3. Blog CMS + SEO
- Blog admin: status filter, tag editor, scheduled publish date, SEO title/description/OG per post, live reading-time.
- Blog index and post pages: canonical tags, Article JSON-LD, OG/Twitter images from the post cover, tag pages, previous/next links.

### 4. Global SEO layer
- SEO settings actually applied: default title template, default description, default OG image, Twitter handle, robots default, and optional GA / GTM / Meta Pixel IDs injected once in the root document.
- Every marketing route gets a unique title/description/OG pair; canonical URL on all public routes; dynamic `robots.txt` honouring the robots default.

### 5. Super Admin control centre
- New "Super Admin" hub page grouping the scattered admin screens: users & roles, tenants, plans & features, industry modules, CMS, audit logs, webhooks, affiliates, analytics.
- **Users & roles**: list every user with role, last activity and tenant; change role with confirmation and audit entry; deactivate.
- **Industry & module control**: table of the 8 industry groups / 35 packs and the core modules with per-plan and per-tenant enable switches, so Super Admin can add or remove industry features without code.
- Audit every role, module and plan change.

### 6. Demo accounts and demo data
- Demo Super Admin: `superadmin@digicrm.demo` (same demo password as the existing demo users), plus verification that admin / manager / executive demo logins still work.
- Seed demo records across the industry packs (lending, real estate, healthcare, education, commerce, logistics, manufacturing, IT services, staffing and more) so each pack workspace shows real KPIs, funnels and AI-agent context.
- Sign-in page gets a "demo accounts" helper listing the logins.

### 7. Verification pass
- Signed-in browser walkthrough of each industry workspace and each new CMS screen, confirming data renders, permissions hold (non-super-admins blocked) and no console errors.

## Technical notes

- Pages CMS writes go through the authenticated client with existing super-admin RLS; the public page renderer uses the existing publishable-key server function pattern (`cms.functions.ts`) so it prerenders.
- Module/industry enablement stored in the existing plan features table plus a new tenant-scoped override table (with grants, RLS and audit triggers in the same migration).
- Demo users are created through the server-side Admin API (not a migration, since auth users cannot be seeded in SQL); demo pack records are inserted as literal rows in a migration.
- Analytics IDs render as script tags only when set, and never in the editor preview build path.
