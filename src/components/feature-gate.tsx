import { Link } from "@tanstack/react-router";
import { Sparkles, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHasFeature } from "@/lib/plan";
import { useActiveTenant } from "@/lib/tenants";
import type { ReactNode } from "react";

export function FeatureGate({
  feature,
  children,
  compact = false,
}: {
  feature: string;
  children: ReactNode;
  compact?: boolean;
}) {
  const { active } = useActiveTenant();
  const allowed = useHasFeature(active?.plan, feature);

  if (allowed) return <>{children}</>;
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded px-2 py-1">
        <Lock className="h-3 w-3" /> Prime
      </div>
    );
  }
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Upgrade to Prime</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          The <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{feature}</span> feature is
          included in the Prime plan. Upgrade this workspace to unlock it.
        </p>
        <Button asChild>
          <Link to="/pricing">See plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
