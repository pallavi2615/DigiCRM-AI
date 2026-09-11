import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { can } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

const VALID_ROLES = ["super_admin", "admin", "sales_manager", "sales_executive"];
const TTL_SECONDS = 300;

/**
 * Issues a short-lived signed URL for a role permissions PDF. The link is
 * HMAC-signed server-side and expires after five minutes, so the export cannot
 * be shared or replayed by anyone who is not authorised to view it.
 */
export const issueRolePdfLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { role: string }) => {
    const role = String(input.role);
    if (!VALID_ROLES.includes(role)) throw new Error("Invalid role");
    return { role };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string };
    const { data: rows } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
    const roles = (rows ?? []).map((r: { role: string }) => r.role as AppRole);
    if (!can(roles, "feature-matrix", "view")) {
      throw new Error("You do not have permission to export permission documents.");
    }
    // Only Admin and Super Admin may export another role's permissions.
    const isAdmin = roles.includes("super_admin") || roles.includes("admin");
    if (!isAdmin && !roles.includes(data.role as AppRole)) {
      throw new Error("You may only download the permissions document for your own role.");
    }


    const { signRolePdfClaims } = await import("@/lib/pdf-signing.server");
    const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const claims = { role: data.role, uid: ctx.userId, exp };
    const sig = signRolePdfClaims(claims);
    const url = `/api/public/role-pdf?role=${encodeURIComponent(data.role)}&uid=${encodeURIComponent(ctx.userId)}&exp=${exp}&sig=${sig}`;
    return { url, expiresAt: new Date(exp * 1000).toISOString() };
  });
