# Fix access scoping, pipeline filters, tasks and AI

Nine reported issues, grouped into four workstreams. Every visibility rule is enforced in the database (row-level security) first, with the interface following the same rules — so nothing can be reached by typing a URL.

## 1. Who can see what (the core fix)

Today most records are visible to any signed-in staff member. New rule:

- Each record belongs to a workspace (an industry CRM such as Healthcare or Fintech) and has an owner.
- Sales Executive: sees only records they own or are assigned, inside workspaces they belong to.
- Sales Manager: sees everything inside their workspaces.
- Admin: same as manager, across their workspaces.
- Super Admin: sees everything.

Applies to Leads, Contacts, Companies, Tasks, Meetings, Proposals, Tickets, Reports and the Dashboard counters.

Work:
- Add a workspace column to Tasks, Meetings and Proposals (Leads, Contacts, Companies and Tickets already have one), backfilled from the linked lead/owner.
- Rewrite the access rules on those tables to the four-tier model above, using a single shared helper so they can't drift apart.
- Every list screen stops asking for "all rows" and asks scoped to the active workspace; the workspace picker only lists workspaces the person belongs to.
- Tickets: filtered by the workspace they were raised in, so a Healthcare ticket no longer appears in Fintech.
- Reports and Dashboard KPIs read through the same scoped queries.

## 2. Sidebar and industry access

- The sidebar builds its "Industry CRMs" list from the industries the signed-in person's workspaces actually use, instead of a hard-coded list of all twelve.
- Opening an unauthorised industry page directly shows a "no access" screen instead of the workspace.
- Super Admin keeps the full list.

## 3. Feature & Permission Matrix

- A regular user sees only their own role card and only the modules they can reach, with their own view/create/edit/delete rights.
- Super Admin (and Admin) keeps the full comparison table.
- The matrix data and the role PDF are served by a server call that checks the caller's role and refuses to return another role's data, so the full matrix can't be pulled by a non-admin.

## 4. Pipeline, Tasks, Proposals, AI

**Pipeline**
- Deals sort Urgent → High → Medium → Low inside each stage, newest first as a tie-break.
- A Filter button at the top with Priority, Stage and Company, plus a clear-all; active filters shown as chips.
- The board only loads deals the person is allowed to see (workstream 1).

**Tasks**
- Create/edit/delete buttons follow the permission rules and disappear when not allowed.
- Attachments on the new-task form: drag-and-drop or browse, multiple files, image thumbnails, name and size, remove before saving, type and size validation (images and documents, 10 MB each). Files go to the private attachments store with per-task access rules.
- Clicking a task opens a details view showing title, description, priority, due date, status, creator and assignee, and all attachments with image previews and download links, plus edit/delete when permitted.

**Proposals**
- "Request approval" only submits the request; the Approve and Reject buttons appear only for Admin and Super Admin (the database already refuses others, the interface will now match).
- Fix the approval date so requested/approved timestamps show correctly.

**AI Assistant**
- Diagnose the "AI is currently unavailable" error: confirm the AI key reaches the server function, then make the failure messages specific (not configured / out of credits / busy) instead of one generic line.

## Technical notes

- New migration: workspace column + index on tasks, meetings, proposals; backfill; replacement RLS policies using a `private.can_see_record(owner, assignee, tenant)` helper; storage policies for task attachments.
- New `src/lib/matrix.functions.ts` server function returning role-filtered matrix rows; `feature-matrix.tsx` renders from it.
- Pipeline gains a filter popover component; sorting by a priority rank map.
- `tasks.tsx` split into list + `TaskDetailDialog` + `TaskAttachments` components; uploads via the existing image-upload helper extended to generic files.
- Sidebar industry list derived from `useMyTenants()` industries; `industry.$slug` and pack routes gated by a shared `useIndustryAccess` guard backed by a server check.
