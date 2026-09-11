import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, FileText, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndustryGuard } from "@/components/industry-guard";

export const Route = createFileRoute("/_authenticated/productsales")({
  head: () => ({ meta: [{ title: "Product Sales CRM — DigiCRM AI" }] }),
  component: ProductSalesLayout,
});

const tabs = [
  { to: "/productsales", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/productsales/products", label: "Products", icon: Package },
  { to: "/productsales/orders", label: "Quotes & Orders", icon: FileText },
  { to: "/productsales/commissions", label: "Commissions", icon: Coins },
];

function ProductSalesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card/50 backdrop-blur">
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Product Sales CRM</h1>
              <p className="text-xs text-muted-foreground">Catalog · Quotes · Orders · Commissions</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap",
                  isActive(t.to, t.exact) ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                )}>
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <IndustryGuard group="commerce">
          <Outlet />
        </IndustryGuard>
      </div>
    </div>
  );
}
