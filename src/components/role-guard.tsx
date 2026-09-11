import { Link } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Loader2, ShieldOff } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { logAccessDenied } from "@/lib/audit";
import { Button } from "@/components/ui/button";

/**
 * Route-level authorization guard. Backend RLS remains the security boundary;
 * this renders an explicit Access denied screen instead of a broken/empty page
 * when a user opens a restricted route directly (nav is also hidden for them).
 */
export function RoleGuard({
  children,
  allow,
  module,
  label,
}: {
  children: ReactNode;
  allow: AppRole[];
  module?: string;
  label?: string;
}) {
  const { loading, roles, user } = useAuth();
  const logged = useRef(false);
  const allowed = !!user && roles.some((r) => allow.includes(r));

  useEffect(() => {
    if (loading || allowed || !module || logged.current || !user) return;
    logged.current = true;
    void logAccessDenied(module, "view", null, "insufficient_role", null);
  }, [loading, allowed, module, user]);

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
        <h2 className="text-lg font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground">
          {label ? `${label} is ` : "This module is "}
          restricted to {allow.includes("super_admin") && allow.length === 1 ? "Super Admins" : "workspace administrators"}.
          Contact your administrator if you need access.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export const ADMINS: AppRole[] = ["super_admin", "admin"];
export const SUPER_ONLY: AppRole[] = ["super_admin"];
