import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { useIndustryAccess } from "@/lib/industry-access";
import { useActiveIndustry } from "@/lib/active-industry";

/**
 * Hides an industry workspace from people who have not been given access to
 * that industry. The database policies enforce the same rule server-side.
 */
export function IndustryGuard({ group, children }: { group: string; children: ReactNode }) {
  const access = useIndustryAccess();
  const { active, setActive, allowed } = useActiveIndustry();
  const permitted = access.canUse(group);

  // Opening an industry workspace makes it the active CRM, so the menu and
  // every record list follow the person into that industry.
  useEffect(() => {
    if (permitted && active !== group && allowed.some((g) => g.slug === group)) setActive(group);
  }, [permitted, active, group, allowed, setActive]);

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
          <h2 className="text-lg font-semibold">This industry is not part of your access</h2>
          <p className="text-sm text-muted-foreground">
            Ask an administrator to add this industry to your account, then it will appear in your menu.
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
