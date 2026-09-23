import { Check, ChevronsUpDown, Building2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
          <Building2 className="h-4 w-4 mr-2" /> Create tenant
        </Link>
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[200px] justify-between">
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{active?.name ?? "Select tenant"}</span>
            {active?.plan === "prime" && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                <Crown className="h-2.5 w-2.5 mr-0.5" /> Prime
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-1" align="end">
        <div className="max-h-[320px] overflow-y-auto">
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-muted text-left text-sm"
            >
              <Check className={`h-4 w-4 ${active?.id === t.id ? "opacity-100" : "opacity-0"}`} />
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 truncate">
                <div className="truncate">{t.name}</div>
                <div className="text-[11px] text-muted-foreground">/t/{t.slug}</div>
              </div>
              <Badge variant={t.plan === "prime" ? "default" : "outline"} className="text-[10px] py-0 px-1.5">
                {t.plan}
              </Badge>
            </button>
          ))}
        </div>
        <div className="border-t mt-1 pt-1">
          <Link to="/settings-tenants" onClick={() => setOpen(false)}
            className="block px-2 py-2 rounded hover:bg-muted text-sm text-primary">
            Manage tenants →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
