import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { useIndustryAccess, groupForRoute } from "@/lib/industry-access";
import { useActiveIndustry } from "@/lib/active-industry";

/**
 * Hides an industry workspace from people whose tenant is not subscribed to
 * that industry. The backend enforces the same rule with require_industry().
 *
 * Pass `route` (preferred — exact tenant-industry check, e.g. "/it") or
 * `group` (taxonomy group slug; less precise because some groups contain
 * more than one CRM, e.g. financial-services = fintech + insurance).
 */
export function IndustryGuard({
  group,
  route,
  children,
}: {
  group?: string;
  route?: string;
  children: ReactNode;
}) {
  const access = useIndustryAccess();
  const { active, setActive, allowed, isSuperAdmin } = useActiveIndustry();

  const resolvedGroup = group ?? (route ? groupForRoute(route) : undefined);
  const permitted = route ? access.canUseRoute(route) : access.canUse(group);

  // Opening an industry workspace makes it the active CRM (SuperAdmin only —
  // everyone else is locked to their tenant's industry by useActiveIndustry).
  useEffect(() => {
    if (
      isSuperAdmin &&
      permitted &&
      resolvedGroup &&
      active !== resolvedGroup &&
      allowed.some((g) => g.slug === resolvedGroup)
    ) {
      setActive(resolvedGroup);
    }
  }, [isSuperAdmin, permitted, active, resolvedGroup, allowed, setActive]);

  if (access.loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!permitted) {
    return (
      <Card className="shadow-card max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">This CRM isn't enabled for your workspace</h2>
          <p className="text-sm text-muted-foreground">
            Please contact your Admin to get access to this industry.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}