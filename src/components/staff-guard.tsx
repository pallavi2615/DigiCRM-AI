import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Loader2, ShieldOff } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { logAccessDenied, logAccessGranted } from "@/lib/audit";
import { useActiveTenant } from "@/lib/queries/tenants";

const STAFF: AppRole[] = ["super_admin", "admin", "sales_manager", "sales_executive"];

/**
 * Client-side guard for internal-staff-only screens (lenders, loan products,
 * product catalog). Backend RLS already restricts the underlying tables to
 * these roles; this component blocks the UI so a user whose role was revoked
 * sees an explicit denial instead of an empty list + failing writes.
 *
 * When `module` is set, every grant and denial is recorded in the activities
 * audit log, scoped to the currently active tenant so admins can trace
 * per-workspace access to global pricing / commission data.
 */
export function StaffGuard({
  children,
  module,
}: {
  children: ReactNode;
  module?: string;
}) {
  const { loading, roles, user } = useAuth();
  const { active } = useActiveTenant();
  const logged = useRef(false);

  const allowed = !!user && roles.some((r) => STAFF.includes(r));

  useEffect(() => {
    if (loading || !module || logged.current || !user) return;
    logged.current = true;
    const tenantId = active?.id ?? null;
    if (allowed) {
      void logAccessGranted(module, "view", tenantId);
    } else {
      void logAccessDenied(module, "view", null, "not_staff_role", tenantId);
    }
  }, [loading, allowed, module, user, active?.id]);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="p-12 max-w-md mx-auto text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <ShieldOff className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Access restricted</h2>
        <p className="text-sm text-muted-foreground">
          This module is limited to internal sales staff. Contact your workspace
          admin if you believe you should have access.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
