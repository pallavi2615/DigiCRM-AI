import { useState } from "react";
import { Check, ChevronsUpDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQueryClient } from "@tanstack/react-query";
import { ALL_CRMS, useActiveIndustry } from "@/lib/active-industry";

/**
 * Lets a person move between the industry CRMs their account is allowed to
 * open. Choosing one narrows the whole app — menu, records, pipeline, tasks,
 * tickets and reports — to that industry.
 */
export function CrmSwitcher() {
  const { allowed, active, activeName, setActive, canSwitch, loading } = useActiveIndustry();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  if (loading || allowed.length === 0) return null;

  if (!canSwitch) {
    return (
      <div className="hidden md:flex items-center gap-2 rounded-md border px-3 h-9 text-sm">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="truncate max-w-[160px]">{allowed[0]?.name}</span>
      </div>
    );
  }

  const choose = (slug: string) => {
    setActive(slug);
    setOpen(false);
    qc.invalidateQueries();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
          <span className="flex items-center gap-2 truncate">
            <Layers className="h-4 w-4 shrink-0" />
            <span className="truncate">{active === ALL_CRMS ? "All industries" : activeName}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-1" align="end">
        <button
          onClick={() => choose(ALL_CRMS)}
          className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left"
        >
          <Check className={`h-4 w-4 ${active === ALL_CRMS ? "opacity-100" : "opacity-0"}`} />
          All industries
        </button>
        <div className="my-1 h-px bg-border" />
        <div className="max-h-[320px] overflow-y-auto">
          {allowed.map((g) => (
            <button
              key={g.slug}
              onClick={() => choose(g.slug)}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent text-left"
            >
              <Check className={`h-4 w-4 shrink-0 ${active === g.slug ? "opacity-100" : "opacity-0"}`} />
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
