import { useState } from "react";
import { Check, ChevronsUpDown, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { ALL_CRMS, useActiveIndustry } from "@/lib/active-industry";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";

const isSuperAdminRole = (r: unknown) => {
  const v = String(r ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return v === "super_admin" || v === "superadmin";
};

export function CrmSwitcher() {
  const { roles } = useAuth();
  const { allowed, active, activeName, setActive, loading } = useActiveIndustry();
  const [open, setOpen] = useState(false);

  // Safety net: even if this component is rendered elsewhere,
  // only the SuperAdmin ever sees the switcher. Everyone else is
  // locked to their own industry and gets no CRM UI at all.
  const isSuperAdmin = roles.some(isSuperAdminRole);
  if (!isSuperAdmin) return null;

  if (loading || allowed.length === 0) return null;

  const choose = (slug: string) => {
    setActive(slug);
    setOpen(false);
  };

  // Har group ke saath uski sub-industries dikhao, taaki industries
  // group-wise ek saath dikhein.
  const subIndustries = (slug: string) =>
    INDUSTRY_GROUPS.find((g) => g.slug === slug)?.children.map((c) => c.name) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-45 justify-between"
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {active === ALL_CRMS ? "All industries" : `${activeName} CRM`}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 max-h-96 overflow-y-auto p-1" align="end">
        <button
          type="button"
          onClick={() => choose(ALL_CRMS)}
          className="flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent"
        >
          <Check className={`mr-2 h-4 w-4 shrink-0 ${active === ALL_CRMS ? "opacity-100" : "opacity-0"}`} />
          All industries
        </button>

        <div className="my-1 h-px bg-border" />

        {allowed.map((industry) => {
          const subs = subIndustries(industry.slug);
          return (
            <button
              key={industry.slug}
              type="button"
              onClick={() => choose(industry.slug)}
              className="flex w-full items-start rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <Check
                className={`mr-2 mt-0.5 h-4 w-4 shrink-0 ${active === industry.slug ? "opacity-100" : "opacity-0"}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{industry.name}</span>
                {subs.length > 0 && (
                  <span className="block text-xs text-muted-foreground leading-snug">
                    {subs.join(" · ")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}