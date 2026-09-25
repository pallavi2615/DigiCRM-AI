import { useAuth } from "@/hooks/use-auth";
import { useIndustryAccess, groupForRoute } from "@/lib/industry-access";
import { useActiveIndustry } from "@/lib/active-industry";
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
  Clock,
} from "lucide-react";

const primary = [
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

const insights = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "AI Assistant", url: "/ai", icon: Sparkles },
  { title: "Proposals", url: "/proposals", icon: FileText },
  { title: "Automation", url: "/automation", icon: Zap },
];

const support = [
  { title: "Tickets", url: "/tickets", icon: LifeBuoy },
  { title: "Inbound Leads", url: "/inbound", icon: Radio },
  { title: "Lead Sources", url: "/lead-sources", icon: TrendingUp },
];

const industries = [
  { title: "Industry Packs", url: "/packs", icon: Layers },
  { title: "DigiVerify", url: "/digiverify", icon: ShieldCheck },
  { title: "Fintech DSA", url: "/fintech", icon: Landmark },
  { title: "Real Estate", url: "/realestate", icon: Home },
  { title: "IT Company", url: "/it", icon: Laptop },
  { title: "Product Sales", url: "/productsales", icon: Package },
  { title: "Healthcare", url: "/industry/healthcare-clinics", icon: Stethoscope },
  { title: "Education", url: "/industry/education", icon: GraduationCap },
  { title: "Insurance", url: "/industry/insurance", icon: ShieldCheck },
  { title: "Automotive", url: "/industry/automotive", icon: Car },
  { title: "Travel", url: "/industry/travel", icon: Plane },
  { title: "Manufacturing", url: "/industry/manufacturing", icon: Factory },
];

const system = [
  { title: "My Workspace", url: "/tenant-dashboard", icon: Layers },
  { title: "Portal Desk", url: "/tenant-portal", icon: Layers },
  { title: "Billing", url: "/tenant-billing", icon: Wallet },
  { title: "DigiPortal", url: "/portal", icon: Layers },
  { title: "Partner Payouts", url: "/partner", icon: HandCoins },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Feature Matrix", url: "/feature-matrix", icon: ShieldCheck },
  { title: "Settings", url: "/settings", icon: Settings },
];

/** Admin + Super Admin only. */
const adminOnly = [
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

/** Super Admin only. */
const superAdminOnly = [
  { title: "Super Admin", url: "/admin", icon: Crown },
  { title: "Industry Pack CMS", url: "/admin-packs", icon: Layers },
  { title: "Plans & Features", url: "/settings-plans", icon: Crown },
  { title: "Content (CMS)", url: "/settings-cms", icon: FileText },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { roles } = useAuth();
  const access = useIndustryAccess();

  // NOTE: useActiveIndustry() returns "activeGroup" (not "group").
  // Destructuring it as `group: activeGroup` was silently producing
  // `undefined`, which is why the industry filter never actually filtered.
  const { activeGroup, activeName } = useActiveIndustry();

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  // Only filters the CRM items already in the `industries` list above
  // (never pulls in extra sub-industries from the taxonomy). When an
  // industry is selected via the CRM switcher, only that industry's
  // items show; when "All industries" is active, everything the user
  // has access to shows.
  const visibleIndustries = industries.filter((i) => {
    if (!access.canUseRoute(i.url)) return false;
    if (!activeGroup) return true;
    return groupForRoute(i.url) === activeGroup;
  });

  const industryLabel = activeGroup ? `${activeName} CRM` : "Industry CRMs";

  const renderGroup = (label: string, items: typeof primary) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <img src="/logo.png" alt="DigiCRM AI" width={32} height={32} className="h-8 w-8 rounded-lg shrink-0 shadow-elegant" />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm" style={{fontFamily: "var(--font-display)"}}>DigiCRM AI</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Workspace", primary)}
        {renderGroup("Support", support)}
        {visibleIndustries.length > 0 && renderGroup(industryLabel, visibleIndustries)}
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