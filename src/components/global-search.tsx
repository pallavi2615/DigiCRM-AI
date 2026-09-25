import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import {
  Users,
  UserCircle,
  Building2,
  CheckSquare,
  LayoutDashboard,
  KanbanSquare,
  Sparkles,
  BarChart3,
  Bell,
  Settings,
  FileText,
  ScrollText,
  Calendar,
  Video,
  Zap,
  LifeBuoy,
  Radio,
  TrendingUp,
  Layers,
  ShieldCheck,
  Wallet,
  HandCoins,
  Inbox,
  Activity,
  Crown,
  Clock,
  Landmark,
  Home,
  Laptop,
  Package,
  Stethoscope,
  GraduationCap,
  Car,
  Plane,
  Factory,
} from "lucide-react";

import {
  ALL_CRMS,
  useActiveIndustry,
  groupForRoute,
} from "@/lib/active-industry";

import type { IndustryGroup } from "@/lib/industry-taxonomy";

interface SearchItem {
  id: string;
  label: string;
  route: string;
  group: string;
  keywords?: string[];
  icon: React.ElementType;
}

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}

/*
 * Same existing application routes that are present
 * in the sidebar.
 *
 * No database/API search.
 */
const navigationItems: SearchItem[] = [
  // Workspace
  {
    id: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    group: "Workspace",
    icon: LayoutDashboard,
  },
  {
    id: "leads",
    label: "Leads",
    route: "/leads",
    group: "Workspace",
    icon: Users,
  },
  {
    id: "followups",
    label: "Follow-ups",
    route: "/followups",
    group: "Workspace",
    icon: Clock,
  },
  {
    id: "contacts",
    label: "Contacts",
    route: "/contacts",
    group: "Workspace",
    icon: UserCircle,
  },
  {
    id: "companies",
    label: "Companies",
    route: "/companies",
    group: "Workspace",
    icon: Building2,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    route: "/pipeline",
    group: "Workspace",
    icon: KanbanSquare,
  },
  {
    id: "tasks",
    label: "Tasks",
    route: "/tasks",
    group: "Workspace",
    icon: CheckSquare,
  },
  {
    id: "calendar",
    label: "Calendar",
    route: "/calendar",
    group: "Workspace",
    icon: Calendar,
  },
  {
    id: "meetings",
    label: "Meetings",
    route: "/meetings",
    group: "Workspace",
    icon: Video,
  },

  // Support
  {
    id: "tickets",
    label: "Tickets",
    route: "/tickets",
    group: "Support",
    icon: LifeBuoy,
  },
  {
    id: "inbound",
    label: "Inbound Leads",
    route: "/inbound",
    group: "Support",
    icon: Radio,
  },
  {
    id: "lead-sources",
    label: "Lead Sources",
    route: "/lead-sources",
    group: "Support",
    icon: TrendingUp,
  },

  // Existing CRM pages
  {
    id: "industry-packs",
    label: "Industry Packs",
    route: "/packs",
    group: "Industry",
    icon: Layers,
  },
  {
    id: "digiverify",
    label: "DigiVerify",
    route: "/digiverify",
    group: "Industry",
    icon: ShieldCheck,
  },
  {
    id: "fintech",
    label: "Fintech DSA",
    route: "/fintech",
    group: "Industry",
    icon: Landmark,
  },
  {
    id: "realestate",
    label: "Real Estate",
    route: "/realestate",
    group: "Industry",
    icon: Home,
  },
  {
    id: "it",
    label: "IT Company",
    route: "/it",
    group: "Industry",
    icon: Laptop,
  },
  {
    id: "productsales",
    label: "Product Sales",
    route: "/productsales",
    group: "Industry",
    icon: Package,
  },
  {
    id: "healthcare",
    label: "Healthcare",
    route: "/industry/healthcare-clinics",
    group: "Industry",
    icon: Stethoscope,
  },
  {
    id: "education",
    label: "Education",
    route: "/industry/education",
    group: "Industry",
    icon: GraduationCap,
  },
  {
    id: "insurance",
    label: "Insurance",
    route: "/industry/insurance",
    group: "Industry",
    icon: ShieldCheck,
  },
  {
    id: "automotive",
    label: "Automotive",
    route: "/industry/automotive",
    group: "Industry",
    icon: Car,
  },
  {
    id: "travel",
    label: "Travel",
    route: "/industry/travel",
    group: "Industry",
    icon: Plane,
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    route: "/industry/manufacturing",
    group: "Industry",
    icon: Factory,
  },

  // Insights
  {
    id: "reports",
    label: "Reports",
    route: "/reports",
    group: "Insights",
    icon: BarChart3,
  },
  {
    id: "ai",
    label: "AI Assistant",
    route: "/ai",
    group: "Insights",
    icon: Sparkles,
  },
  {
    id: "proposals",
    label: "Proposals",
    route: "/proposals",
    group: "Insights",
    icon: FileText,
  },
  {
    id: "automation",
    label: "Automation",
    route: "/automation",
    group: "Insights",
    icon: Zap,
  },

  // System
  {
    id: "tenant-dashboard",
    label: "My Workspace",
    route: "/tenant-dashboard",
    group: "System",
    icon: Layers,
  },
  {
    id: "tenant-portal",
    label: "Portal Desk",
    route: "/tenant-portal",
    group: "System",
    icon: Layers,
  },
  {
    id: "tenant-billing",
    label: "Billing",
    route: "/tenant-billing",
    group: "System",
    icon: Wallet,
  },
  {
    id: "portal",
    label: "DigiPortal",
    route: "/portal",
    group: "System",
    icon: Layers,
  },
  {
    id: "partner",
    label: "Partner Payouts",
    route: "/partner",
    group: "System",
    icon: HandCoins,
  },
  {
    id: "notifications",
    label: "Notifications",
    route: "/notifications",
    group: "System",
    icon: Bell,
  },
  {
    id: "feature-matrix",
    label: "Feature Matrix",
    route: "/feature-matrix",
    group: "System",
    icon: ShieldCheck,
  },
  {
    id: "settings",
    label: "Settings",
    route: "/settings",
    group: "System",
    icon: Settings,
  },

  // Admin
  {
    id: "webhook-dead-letter",
    label: "Webhook Retries",
    route: "/webhook-dead-letter",
    group: "Administration",
    icon: Inbox,
  },
  {
    id: "webhook-settings",
    label: "Webhook Settings",
    route: "/webhook-settings",
    group: "Administration",
    icon: Settings,
  },
  {
    id: "audit-logs",
    label: "Audit Logs",
    route: "/audit-logs",
    group: "Administration",
    icon: ScrollText,
  },
  {
    id: "landing-analytics",
    label: "Landing Analytics",
    route: "/landing-analytics",
    group: "Administration",
    icon: Activity,
  },
  {
    id: "landing-conversions",
    label: "Conversions",
    route: "/landing-conversions",
    group: "Administration",
    icon: TrendingUp,
  },
  {
    id: "affiliates",
    label: "Affiliates",
    route: "/affiliates",
    group: "Administration",
    icon: Users,
  },
  {
    id: "payout-history",
    label: "Payout History",
    route: "/payout-history",
    group: "Administration",
    icon: Wallet,
  },
  {
    id: "settings-tenants",
    label: "Tenants",
    route: "/settings-tenants",
    group: "Administration",
    icon: Layers,
  },
  {
    id: "settings-pack",
    label: "Pack Settings",
    route: "/settings-pack",
    group: "Administration",
    icon: Settings,
  },
  {
    id: "onboarding",
    label: "New Workspace",
    route: "/onboarding",
    group: "Administration",
    icon: Layers,
  },

  // Super Admin
  {
    id: "admin",
    label: "Super Admin",
    route: "/admin",
    group: "Super Admin",
    icon: Crown,
  },
  {
    id: "admin-packs",
    label: "Industry Pack CMS",
    route: "/admin-packs",
    group: "Super Admin",
    icon: Layers,
  },
  {
    id: "settings-plans",
    label: "Plans & Features",
    route: "/settings-plans",
    group: "Super Admin",
    icon: Crown,
  },
  {
    id: "settings-cms",
    label: "Content (CMS)",
    route: "/settings-cms",
    group: "Super Admin",
    icon: FileText,
  },
];

function getExistingCrmItemsForIndustry(
  activeGroup: IndustryGroup | null
): SearchItem[] {
  if (!activeGroup) {
    return navigationItems.filter(
      (item) => item.group === "Industry"
    );
  }

  /*
   * Filter EXISTING CRM routes only.
   *
   * No route is created from industry-taxonomy.
   */
  return navigationItems.filter((item) => {
    if (item.group !== "Industry") {
      return false;
    }

    return groupForRoute(item.route) === String(activeGroup);
  });
}

export function GlobalSearch({
  open,
  onOpenChange,
}: Props) {
  const navigate = useNavigate();

  const [q, setQ] = useState("");

  const {
    activeGroup,
    activeName,
  } = useActiveIndustry();

  /*
   * Existing CRM entries related to selected industry.
   */
  const existingCrms = useMemo(
    () =>
      getExistingCrmItemsForIndustry(
        activeGroup as IndustryGroup | null
      ),
    [activeGroup]
  );

  const searchableItems = useMemo(() => {
    const baseItems = navigationItems.filter(
      (item) => {
        /*
         * Industry items are handled separately
         * so only selected industry's existing CRMs
         * are shown.
         */
        if (item.group === "Industry") {
          return false;
        }

        return true;
      }
    );

    return [
      ...baseItems,
      ...existingCrms.map((item) => ({
        ...item,
        group:
          activeGroup
            ? `${activeName} CRM`
            : "Industry",
      })),
    ];
  }, [
    activeGroup,
    activeName,
    existingCrms,
  ]);

  const filteredItems = useMemo(() => {
    const term = q.trim().toLowerCase();

    if (!term) {
      return searchableItems;
    }

    return searchableItems.filter((item) => {
      const searchableText = [
        item.label,
        item.group,
        item.route,
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(term);
    });
  }, [q, searchableItems]);

  /*
   * Group results by sidebar section.
   */
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchItem[]>();

    for (const item of filteredItems) {
      const existing = groups.get(item.group) ?? [];
      existing.push(item);
      groups.set(item.group, existing);
    }

    return Array.from(groups.entries());
  }, [filteredItems]);

  useEffect(() => {
    if (!open) {
      setQ("");
    }
  }, [open]);

  const go = (route: string) => {
    onOpenChange(false);

    navigate({
      to: route as any,
    });
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <CommandInput
        placeholder="Search pages, tabs, CRM..."
        value={q}
        onValueChange={setQ}
      />

      <CommandList>
        <CommandEmpty>
          No matching page or CRM found.
        </CommandEmpty>

        {groupedResults.map(
          ([group, items], index) => (
            <div key={group}>
              {index > 0 && <CommandSeparator />}

              <CommandGroup heading={group}>
                {items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.group} ${item.route}`}
                      onSelect={() =>
                        go(item.route)
                      }
                    >
                      <Icon className="mr-2 h-4 w-4" />

                      <div className="flex flex-col">
                        <span>
                          {item.label}
                        </span>

                        {item.group && (
                          <span className="text-xs text-muted-foreground">
                            {item.group}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          )
        )}
      </CommandList>
    </CommandDialog>
  );
}