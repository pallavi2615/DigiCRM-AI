import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** The sections every industry workspace has, each with its own page. */
export const INDUSTRY_TABS = [
  { key: "leads", label: "Leads" },
  { key: "pipeline", label: "Pipeline" },
  { key: "contacts", label: "Contacts" },
  { key: "companies", label: "Companies" },
  { key: "tasks", label: "Tasks" },
  { key: "meetings", label: "Meetings" },
  { key: "calendar", label: "Calendar" },
  { key: "reports", label: "Reports" },
  { key: "documents", label: "Documents" },
  { key: "payments", label: "Payments" },
  { key: "tickets", label: "Tickets" },
] as const;

export type IndustryTabKey = (typeof INDUSTRY_TABS)[number]["key"];

export function IndustryTabs({ slug }: { slug: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/industry/${slug}`;
  const linkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
      active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="-mx-1 overflow-x-auto">
      <nav className="flex min-w-max gap-1 rounded-lg border bg-muted/40 p-1">
        <Link to="/industry/$slug" params={{ slug }} className={linkClass(pathname === base)}>
          Overview
        </Link>
        {INDUSTRY_TABS.map((t) => (
          <Link
            key={t.key}
            to="/industry/$slug/$section"
            params={{ slug, section: t.key }}
            className={linkClass(pathname === `${base}/${t.key}`)}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
