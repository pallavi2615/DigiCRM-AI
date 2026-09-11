import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { can, type Action } from "@/lib/permissions";

/**
 * UI-level permission helper. The database RLS policies remain the security
 * boundary — this only hides or disables controls a role may not use so the
 * interface never offers an action that would fail server-side.
 */
export function usePermissions() {
  const { roles, loading } = useAuth();

  const allowed = useCallback(
    (moduleKey: string, action: Action) => can(roles, moduleKey, action),
    [roles],
  );

  return {
    loading,
    roles,
    can: allowed,
    canView: (m: string) => allowed(m, "view"),
    canCreate: (m: string) => allowed(m, "create"),
    canEdit: (m: string) => allowed(m, "edit"),
    canDelete: (m: string) => allowed(m, "delete"),
  };
}
