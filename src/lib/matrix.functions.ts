import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODULES, ROLES, type Action } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

/**
 * Server-side source of truth for the Feature & Permission Matrix.
 *
 * A regular user only ever receives their own role card and only the modules
 * their role can reach — the other roles' permission data never leaves the
 * server, so it cannot be read by inspecting the page or the response.
 */

export interface MatrixRow {
  key: string;
  label: string;
  panel: string;
  route: string | null;
  description: string;
  perms: Record<string, Action[]>;
}

export interface MatrixPayload {
  /** Roles the caller may see permission data for. */
  roles: { key: AppRole; label: string; blurb: string }[];
  /** Roles the caller actually holds. */
  myRoles: AppRole[];
  /** True when the caller sees the whole comparison table. */
  full: boolean;
  rows: MatrixRow[];
}

export const getPermissionMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MatrixPayload> => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { data } = await ctx.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId);
    const myRoles = (data ?? []).map((r: { role: string }) => r.role as AppRole);

    const full = myRoles.includes("super_admin") || myRoles.includes("admin");
    const visible: AppRole[] = full ? ROLES.map((r) => r.key) : myRoles;

    const rows: MatrixRow[] = MODULES.filter((m) =>
      full ? true : visible.some((r) => (m.perms[r] ?? []).length > 0),
    ).map((m) => ({
      key: m.key,
      label: m.label,
      panel: m.panel,
      route: m.route ?? null,
      description: m.description,
      perms: Object.fromEntries(visible.map((r) => [r, m.perms[r] ?? []])),
    }));

    return {
      roles: ROLES.filter((r) => visible.includes(r.key)),
      myRoles,
      full,
      rows,
    };
  });
