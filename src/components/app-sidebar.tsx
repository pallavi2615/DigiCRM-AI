import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIndustryAccess, groupForRoute, isCrmRoute } from "@/lib/industry-access";
import { ALL_CRMS, useActiveIndustry } from "@/lib/active-industry";
import { Link, useRouterState } from "@tanstack/react-router";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Building2, UserCircle, KanbanSquare, CheckSquare,
  Calendar, Video, BarChart3, Sparkles, FileText, Zap, Bell, Settings, ScrollText,
  Landmark, Home, Laptop, Package, Stethoscope, GraduationCap, ShieldCheck, Car, Plane, Factory,
  Rocket, LifeBuoy, Radio, Crown, Layers, Inbox, TrendingUp, Activity, Wallet, HandCoins,
  Clock, IndianRupee, CreditCard, BookOpen, Store, Palette, ShoppingBag,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  managerUp?: boolean;
};

const primary: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Follow-ups", url: "/followups", icon: Clock },
  { title: "Contacts", url: "/contacts", icon: UserCircle },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Meetings", url: "/meetings", icon: Video },
];

const support: NavItem[] = [
  { title: "Tickets", url: "/tickets", icon: LifeBuoy },
  { title: "Inbound Leads", url: "/inbound", icon: Radio, adminOnly: true },
  { title: "Lead Sources", url: "/lead-sources", icon: TrendingUp },
];

const industries: NavItem[] = [
  { title: "Industry Packs", url: "/packs", icon: Layers },
  { title: "DigiVerify", url: "/digiverify", icon: ShieldCheck },
  { title: "Fintech DSA", url: "/fintech", icon: Landmark },
  { title: "Real Estate", url: "/realestate", icon: Home },
  { title: "Sales App (mobile)", url: "/m", icon: Home },
  { title: "Buyer Portal", url: "/buyer", icon: ShoppingBag },
  { title: "Student Portal", url: "/student-portal", icon: Home },
  { title: "IT Company", url: "/it", icon: Laptop },
  { title: "Product Sales", url: "/productsales", icon: Package },
  { title: "Creator CRM", url: "/creator", icon: Sparkles },
  { title: "Brand Portal", url: "/brand", icon: Palette },
  { title: "Distribution OS", url: "/distribution", icon: Store },
  { title: "Restaurant OS", url: "/restaurant", icon: Store },
  { title: "Coaching CRM", url: "/coaching", icon: GraduationCap },
  { title: "Education", url: "/industry/education", icon: GraduationCap },
  { title: "Healthcare", url: "/industry/healthcare-clinics", icon: Stethoscope },
  { title: "Insurance", url: "/industry/insurance", icon: ShieldCheck },
  { title: "Automotive", url: "/industry/automotive", icon: Car },
  { title: "Travel", url: "/industry/travel", icon: Plane },
  { title: "Manufacturing", url: "/industry/manufacturing", icon: Factory },
];

// Ye items kisi ek group ke nahi hain (shared tools) — SuperAdmin ko
// kisi bhi group select karne par bhi dikhte rehte hain, aur
// inpar click karne se switcher change nahi hota.
const SHARED_ROUTES = new Set<string>(["/packs", "/digiverify", "/m"]);

const industrySubNav: Record<string, NavItem[]> = {
  // Key = route prefix (jo industry array mein url hai)
  "/it": [
    { title: "Dashboard", url: "/it", icon: LayoutDashboard },
    { title: "Projects", url: "/it/projects", icon: KanbanSquare },
    { title: "Tickets & Tasks", url: "/it/tickets", icon: CheckSquare },
    { title: "Pipeline", url: "/it/pipeline", icon: TrendingUp },
  ],
};

const insights: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "AI Assistant", url: "/ai", icon: Sparkles },
  { title: "Proposals", url: "/proposals", icon: FileText },
  { title: "Automation", url: "/automation", icon: Zap, adminOnly: true },
];

const system: NavItem[] = [
  { title: "Industry Workspace", url: "/workspace", icon: Layers },
  { title: "My Workspace", url: "/tenant-dashboard", icon: Layers },
  { title: "Portal Desk", url: "/tenant-portal", icon: Layers },
  { title: "Billing", url: "/tenant-billing", icon: Wallet, managerUp: true },
  { title: "Cash Flow Tracker", url: "/cashflow", icon: IndianRupee, managerUp: true },
  { title: "Payments & Ledger", url: "/payments", icon: CreditCard, managerUp: true },
  { title: "Payout Accounts", url: "/payout-accounts", icon: HandCoins, managerUp: true },
  { title: "Partner Payouts", url: "/partner", icon: HandCoins },
  { title: "Education AI", url: "/education-setup", icon: GraduationCap },
  { title: "DigiPortal", url: "/portal", icon: Layers },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Feature Matrix", url: "/feature-matrix", icon: ShieldCheck, adminOnly: true },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminOnly: NavItem[] = [
  { title: "Webhook Retries", url: "/webhook-dead-letter", icon: Inbox },
  { title: "Webhook Settings", url: "/webhook-settings", icon: Settings },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Landing Analytics", url: "/landing-analytics", icon: Activity },
  { title: "Conversions", url: "/landing-conversions", icon: TrendingUp },
  { title: "Affiliates", url: "/affiliates", icon: Users },
  { title: "Payout History", url: "/payout-history", icon: Wallet },
  { title: "Tenants", url: "/settings-tenants", icon: Layers },
  { title: "Pack Settings", url: "/settings-pack", icon: Settings },
  { title: "New Workspace", url: "/onboarding", icon: Layers },
];

const superAdminOnly: NavItem[] = [
  { title: "Super Admin", url: "/admin", icon: Crown },
  { title: "Industry Pack CMS", url: "/admin-packs", icon: Layers },
  { title: "Template Builder", url: "/admin-templates", icon: Layers },
  { title: "Plans & Features", url: "/settings-plans", icon: Crown },
  { title: "Content (CMS)", url: "/settings-cms", icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // useAuth se ready-made flags — koi manual role calculation nahi
  const { isSuperAdmin, isAdmin, isManager } = useAuth();
  const access = useIndustryAccess();

  // active      = CrmSwitcher mein selected group slug (ya "all")
  // activeGroup = tenant users ka locked group (SuperAdmin ke liye hamesha null)
  const { active, activeGroup, activeName, setActive } = useActiveIndustry();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  // Sidebar se CRM kholne par switcher ko usi group par sync karo.
  // Sirf pathname badalne par chalta hai, taaki switcher ki manual
  // selection se na ladey.
  useEffect(() => {
    if (!isSuperAdmin) return; // tenant users locked hain, switcher unka hai hi nahi

    const match = industries.find((i) => isActive(i.url));
    if (!match || SHARED_ROUTES.has(match.url)) return;

    const group = groupForRoute(match.url);
    if (group && group !== active) setActive(group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isSuperAdmin]);

  const superAdminFilterGroup =
    isSuperAdmin && active && active !== ALL_CRMS ? active : null;

  const visibleIndustries = industries.filter((i) => {
    if (!access.canUseRoute(i.url)) return false;

    // SuperAdmin
    if (isSuperAdmin) {
      // "All industries" => sab dikhao
      if (!superAdminFilterGroup) return true;
      // Shared tools hamesha dikhao
      if (SHARED_ROUTES.has(i.url)) return true;
      // Warna sirf selected group ke CRMs
      return groupForRoute(i.url) === superAdminFilterGroup;
    }

    // Tenant users: sirf unki active industry ke tabs
    if (!activeGroup) return false;
    return groupForRoute(i.url) === activeGroup;
  });

  const currentIndustry = visibleIndustries.find(
    (i) => pathname === i.url || pathname.startsWith(i.url + "/"),
  );

  const currentSubNav = currentIndustry ? industrySubNav[currentIndustry.url] : undefined;

  const crmItems = visibleIndustries.filter((i) => isCrmRoute(i.url));
  const singleTenantCrm = !isSuperAdmin && crmItems.length === 1 ? crmItems[0] : undefined;

  const industryLabel = isSuperAdmin
    ? superAdminFilterGroup && activeName
      ? `${activeName} CRMs`
      : "Industry CRMs"
    : singleTenantCrm
      ? `${singleTenantCrm.title} CRM`
      : "Industry CRMs";

  const filterByRole = (items: NavItem[]): NavItem[] => {
    return items.filter((item) => {
      if (item.superAdminOnly) return isSuperAdmin;
      if (item.adminOnly) return isAdmin;
      if (item.managerUp) return isManager;
      return true;
    });
  };

  const renderGroup = (label: string, items: NavItem[]) => {
    const visibleItems = filterByRole(items);
    if (visibleItems.length === 0) return null;

    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <img src="/logo.png" alt="DigiCRM AI" width={32} height={32} className="h-8 w-8 rounded-lg shrink-0 shadow-elegant" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>DigiCRM AI</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Workspace", primary)}
        {renderGroup("Support", support)}

        {/* Current industry ka sub-nav (Dashboard, Projects, Tickets, Pipeline) */}
        {!access.loading && currentIndustry && currentSubNav && currentSubNav.length > 0 &&
          renderGroup(currentIndustry.title, currentSubNav)}

        {/* Industry list: SuperAdmin ko hamesha, baaki users ko sirf jab koi industry select na ho */}
        {!access.loading && (isSuperAdmin || !currentIndustry) && visibleIndustries.length > 0 &&
          renderGroup(industryLabel, visibleIndustries)}

        {renderGroup("Insights", insights)}
        {isAdmin && renderGroup("Administration", adminOnly)}
        {isSuperAdmin && renderGroup("Super Admin", superAdminOnly)}
        {renderGroup(
          "System",
          access.groups.length === 0 && !isAdmin
            ? [{ title: "Choose your industry", url: "/choose-industry", icon: Layers }, ...system]
            : system,
        )}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && isSuperAdmin && (
          <Link
            to="/settings-cms"
            className="mx-2 mb-2 rounded-lg p-3 text-xs text-white shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)" }}
          >
            <Rocket className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Run a campaign</div>
              <div className="opacity-80 text-[10px]">Create colorful landing pages</div>
            </div>
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}