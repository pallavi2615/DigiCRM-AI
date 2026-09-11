import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listMenuItems } from "@/lib/cms.functions";

type Item = { id: string; label: string; url: string; group_label: string | null };

function FooterLink({ url, label }: { url: string; label: string }) {
  if (url.startsWith("http")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
        {label}
      </a>
    );
  }
  return (
    <Link to={url} className="hover:text-primary transition-colors">
      {label}
    </Link>
  );
}

export function SiteFooter() {
  const fetchMenu = useServerFn(listMenuItems);
  const { data: menu = [] } = useQuery({ queryKey: ["cms-menu"], queryFn: () => fetchMenu() });
  const footer = menu.filter((m) => m.location === "footer") as Item[];

  const groups = new Map<string, Item[]>();
  for (const item of footer) {
    const key = item.group_label?.trim() || "More";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <footer className="border-t border-border/50 mt-24 bg-muted/20">
      <div className="max-w-7xl mx-auto px-6 py-12 grid gap-8 md:grid-cols-5">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="DigiCRM AI" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>DigiCRM AI</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm">
            The AI-native CRM for modern sales teams. Pipelines, proposals, automation & audit-grade governance.
          </p>
        </div>

        {[...groups.entries()].map(([group, items]) => (
          <div key={group}>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">{group}</h4>
            <ul className="space-y-2 text-sm">
              {items.map((m) => (
                <li key={m.id}><FooterLink url={m.url} label={m.label} /></li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Industries</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/dsa-crm" className="hover:text-primary transition-colors font-medium text-primary">DSA CRM (Fintech) ★</Link></li>
            <li><Link to="/industries/$group/$slug" params={{ group: "financial-services", slug: "lending" }} className="hover:text-primary transition-colors">Lending / NBFC</Link></li>
            <li><Link to="/industries/$group/$slug" params={{ group: "property", slug: "real-estate" }} className="hover:text-primary transition-colors">Real Estate</Link></li>
            <li><Link to="/industries/$group/$slug" params={{ group: "professional-services", slug: "it-services" }} className="hover:text-primary transition-colors">IT Services</Link></li>
            <li><Link to="/products" className="hover:text-primary transition-colors">Product suite →</Link></li>
            <li><Link to="/industries" className="hover:text-primary transition-colors">All industries →</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} DigiCRM AI. All rights reserved.
      </div>
    </footer>
  );
}
