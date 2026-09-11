# DigiCRM RBAC / UI test suite

Runs on every PR via `.github/workflows/rbac.yml`.

## Scripts

- `tests/rbac_rest.mjs` — REST/RBAC + audit-log redaction assertions.
- `tests/csv_rbac.mjs` — CSV import (bulk insert) & export (SELECT) RBAC and
  ownership checks for leads, contacts, companies across every role.
- `tests/realtime_isolation.mjs` — Sales Executive realtime subscription must
  never receive `leads` or `contacts` postgres_changes events for rows they
  can't read; every denial is logged to `activities` as `access_denied` with
  `metadata.attempted_action='realtime_subscribe'` and only allow-listed keys.
- `tests/contacts_ui.py` — Playwright smoke that signs in as Sales Executive
  and Admin, verifies restricted contacts are absent from the DOM even after
  changing page size and paginating.
- `tests/csv_ui.py` — Playwright end-to-end for the CSV Import/Export
  screens on Leads, Contacts, Companies across every role: UI import writes
  rows owned by the signed-in user; UI export includes own rows and, for
  Sales Executive, excludes admin-owned HIDDEN rows.

## Required env

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`)
- `TEST_ADMIN_EMAIL`, `TEST_MANAGER_EMAIL`, `TEST_EXEC_EMAIL`
- `TEST_USER_PASSWORD` (shared password for all seeded demo users)
- `APP_URL` (defaults to `http://localhost:8080`)

## Run locally

```bash
node tests/rbac_rest.mjs
python tests/contacts_ui.py
```
