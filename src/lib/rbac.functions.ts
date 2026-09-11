import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can, moduleFor, type Action } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

/**
 * Server-side authorization layer.
 *
 * The UI hides controls a role may not use, but every gated create / edit /
 * delete must also be verified on the server: the role set is re-read from the
 * database for the authenticated caller, checked against the shared permission
 * matrix, and the mutation itself is executed through the caller's own
 * Supabase client so row-level security stays the final boundary.
 */

const ACTIONS: Action[] = ["view", "create", "edit", "delete"];

/** Tables a gated mutation may target, keyed by permission module. */
const MODULE_TABLES: Record<string, { table: string; softDelete: boolean }> = {
  leads: { table: "leads", softDelete: true },
  contacts: { table: "contacts", softDelete: true },
  companies: { table: "companies", softDelete: true },
  tasks: { table: "tasks", softDelete: false },
  meetings: { table: "meetings", softDelete: false },
  tickets: { table: "support_tickets", softDelete: false },
  automation: { table: "automation_rules", softDelete: false },
  fintech: { table: "loan_applications", softDelete: true },
  realestate: { table: "re_properties", softDelete: false },
  it: { table: "it_projects", softDelete: false },
  productsales: { table: "ps_products", softDelete: false },
  affiliates: { table: "affiliates", softDelete: false },
  proposals: { table: "proposals", softDelete: true },
};

const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 4,
  admin: 3,
  sales_manager: 2,
  sales_executive: 1,
};

type Ctx = { supabase: any; userId: string };

async function rolesOf(context: Ctx): Promise<AppRole[]> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  return (data ?? []).map((r: { role: string }) => r.role as AppRole);
}

async function audit(
  context: Ctx,
  moduleKey: string,
  action: string,
  entityId: string | null,
  granted: boolean,
  reason?: string,
) {
  try {
    await context.supabase.from("activities").insert({
      actor_id: context.userId,
      entity_type: moduleKey,
      entity_id: entityId,
      action: granted ? "access_granted" : "access_denied",
      description: `${granted ? "Allowed" : "Denied"} ${action} on ${moduleKey}${reason ? ` — ${reason}` : ""}`,
      metadata: { attempted_action: action, server_checked: true },
    });
  } catch {
    /* best-effort */
  }
}

function parseAction(value: unknown): Action {
  if (typeof value === "string" && (ACTIONS as string[]).includes(value)) return value as Action;
  throw new Error("Invalid action");
}

/** Verifies the caller may perform `action` on `module`. Throws when not. */
export const authorizeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { module: string; action: string; entityId?: string | null }) => ({
    module: String(input.module),
    action: parseAction(input.action),
    entityId: input.entityId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    if (!moduleFor(data.module)) throw new Error(`Unknown module "${data.module}"`);
    const roles = await rolesOf(ctx);
    const allowed = can(roles, data.module, data.action);
    await audit(ctx, data.module, data.action, data.entityId, allowed, allowed ? undefined : "role not permitted");
    if (!allowed) throw new Error(`You do not have permission to ${data.action} ${data.module}.`);
    return { allowed: true as const, roles };
  });

/** Permission-checked delete (soft where the table supports it). */
export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { module: string; id: string }) => ({
    module: String(input.module),
    id: String(input.id),
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const target = MODULE_TABLES[data.module];
    if (!target) throw new Error(`Deletion is not supported for "${data.module}".`);

    const roles = await rolesOf(ctx);
    if (!can(roles, data.module, "delete")) {
      await audit(ctx, data.module, "delete", data.id, false, "role not permitted");
      throw new Error(`You do not have permission to delete ${data.module}.`);
    }

    const query = target.softDelete
      ? ctx.supabase.from(target.table).update({ deleted_at: new Date().toISOString() }).eq("id", data.id)
      : ctx.supabase.from(target.table).delete().eq("id", data.id);

    const { error, count } = await query.select("id", { count: "exact" });
    if (error) {
      await audit(ctx, data.module, "delete", data.id, false, error.message);
      throw new Error(error.message);
    }
    if (!count) {
      // RLS filtered the row out — the caller may not touch this record.
      await audit(ctx, data.module, "delete", data.id, false, "row-level security denied");
      throw new Error("This record is outside your access scope.");
    }
    await audit(ctx, data.module, "delete", data.id, true);
    return { ok: true as const };
  });

/** Permission-checked create/edit guard used before client-side writes. */
export const assertCanWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { module: string; action: string; entityId?: string | null }) => ({
    module: String(input.module),
    action: parseAction(input.action),
    entityId: input.entityId ?? null,
  }))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const roles = await rolesOf(ctx);
    const allowed = can(roles, data.module, data.action);
    if (!allowed) {
      await audit(ctx, data.module, data.action, data.entityId, false, "role not permitted");
      throw new Error(`You do not have permission to ${data.action} ${data.module}.`);
    }
    return { allowed: true as const };
  });

/**
 * Changes a user's workspace role. Super Admin may set any role; Admin may only
 * assign roles junior to their own. The database trigger records the change in
 * the audit log with the actor, target and old/new role.
 */
export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: string }) => {
    const role = String(input.role) as AppRole;
    if (!(role in ROLE_RANK)) throw new Error("Invalid role");
    return { userId: String(input.userId), role };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const roles = await rolesOf(ctx);

    if (!can(roles, "user-roles", "edit")) {
      await audit(ctx, "user-roles", "edit", data.userId, false, "role not permitted");
      throw new Error("You do not have permission to change roles.");
    }
    if (data.userId === ctx.userId) throw new Error("You cannot change your own role.");

    const callerRank = Math.max(...roles.map((r) => ROLE_RANK[r] ?? 0), 0);
    if (callerRank < 4 && ROLE_RANK[data.role] >= callerRank) {
      await audit(ctx, "user-roles", "edit", data.userId, false, "cannot assign an equal or senior role");
      throw new Error("You may only assign roles junior to your own.");
    }

    const { data: existing } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const previous = (existing ?? []).map((r: { role: string }) => r.role as AppRole);

    if (previous.length) {
      const { error: delError } = await ctx.supabase.from("user_roles").delete().eq("user_id", data.userId);
      if (delError) throw new Error(delError.message);
    }
    const { error } = await ctx.supabase.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);

    return { ok: true as const, previous, next: data.role };
  });
