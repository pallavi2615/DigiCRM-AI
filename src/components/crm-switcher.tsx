import { useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  ALL_CRMS,
  useActiveIndustry,
} from "@/lib/active-industry";

export function CrmSwitcher() {
  const {
    allowed,
    active,
    activeName,
    setActive,
    canSwitch,
    loading,
  } = useActiveIndustry();

  const [open, setOpen] = useState(false);

  if (loading || allowed.length === 0) {
    return null;
  }

  if (!canSwitch) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Layers className="h-4 w-4" />

        {allowed[0]?.name}
      </div>
    );
  }

  const choose = (slug: string) => {
    console.log(
      "[CRM SWITCHER] selecting:",
      slug,
    );

    setActive(slug);

    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-w-45 justify-between"
        >
          <span className="flex items-center gap-2">
            <Layers className="h-4 w-4" />

            {active === ALL_CRMS
              ? "All industries"
              : `${activeName} CRM`}
          </span>

          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-55 p-1"
        align="end"
      >
        <button
          type="button"
          onClick={() => choose(ALL_CRMS)}
          className="flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent"
        >
          <Check
            className={`mr-2 h-4 w-4 ${
              active === ALL_CRMS
                ? "opacity-100"
                : "opacity-0"
            }`}
          />

          All industries
        </button>

        {allowed.map((industry) => (
          <button
            key={industry.slug}
            type="button"
            onClick={() =>
              choose(industry.slug)
            }
            className="flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent"
          >
            <Check
              className={`mr-2 h-4 w-4 ${
                active === industry.slug
                  ? "opacity-100"
                  : "opacity-0"
              }`}
            />

            {industry.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}