import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useActiveTenant } from "@/lib/queries/tenants";
import { useState } from "react";
import { Link } from "@tanstack/react-router";

export function TenantSwitcher() {
  const { active, tenants, setActive, loading } = useActiveTenant();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  if (!tenants.length) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/settings-tenants">
          <Building2 className="mr-2 h-4 w-4" />
          Create tenant
        </Link>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-50 justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />

            <span className="truncate">
              {active?.name ?? "Select tenant"}
            </span>

            {active?.status && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px]"
              >
                {active.status}
              </Badge>
            )}
          </div>

          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-70 p-1" align="end">
        <div className="max-h-80 overflow-y-auto">
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActive(String(t.id));
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <Check
                className={`h-4 w-4 ${
                  active?.id === t.id ? "opacity-100" : "opacity-0"
                }`}
              />

              <Building2 className="h-4 w-4 text-muted-foreground" />

              <div className="flex-1 truncate">
                <div className="truncate">{t.name}</div>

                <div className="text-[11px] text-muted-foreground">
                  {t.subdomain
                    ? `${t.subdomain}.digicrm`
                    : `Tenant #${t.id}`}
                </div>
              </div>

              <Badge
                variant={t.status === "active" ? "default" : "outline"}
                className="px-1.5 py-0 text-[10px]"
              >
                {t.status}
              </Badge>
            </button>
          ))}
        </div>

        <div className="mt-1 border-t pt-1">
          <Link
            to="/settings-tenants"
            onClick={() => setOpen(false)}
            className="block rounded px-2 py-2 text-sm text-primary hover:bg-muted"
          >
            Manage tenants →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}