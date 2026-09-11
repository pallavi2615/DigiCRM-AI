import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RotateCcw, Mail } from "lucide-react";
import { toast } from "sonner";

const DENIED_PATTERNS = [
  "do not have permission",
  "permission denied",
  "not authorized",
  "unauthorized",
  "outside your access scope",
  "row-level security",
  "only assign roles junior",
  "violates row-level security policy",
  "403",
];

/** True when an error came from a server-side authorization / RLS block. */
export function isPermissionError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return DENIED_PATTERNS.some((p) => message.includes(p));
}

export const PERMISSION_DENIED_HINT =
  "Your role does not allow this action. Try again, or ask a workspace admin to grant access.";

/**
 * Consistent toast for a blocked action. Falls back to the raw error message
 * for anything that is not an authorization failure.
 */
export function notifyPermissionDenied(error: unknown, retry?: () => void) {
  const message = error instanceof Error ? error.message : String(error ?? "Something went wrong");
  if (!isPermissionError(error)) {
    toast.error(message, retry ? { action: { label: "Retry", onClick: retry } } : undefined);
    return;
  }
  toast.error("Permission denied", {
    description: `${message} ${PERMISSION_DENIED_HINT}`,
    action: retry ? { label: "Retry", onClick: retry } : undefined,
  });
}

/** Full-surface denied state for pages/sections a role may not use. */
export function PermissionDenied({
  title = "Permission denied",
  description,
  onRetry,
  contactEmail = "support@digicrm.ai",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  contactEmail?: string;
}) {
  return (
    <Card className="shadow-card border-destructive/30">
      <CardContent className="p-8 text-center flex flex-col items-center gap-3">
        <span className="rounded-full bg-destructive/10 p-3">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {description ?? PERMISSION_DENIED_HINT}
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" /> Retry
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <a href={`mailto:${contactEmail}?subject=Access%20request`}>
              <Mail className="mr-2 h-4 w-4" /> Request access
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
