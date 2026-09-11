import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { listMenuItems } from "@/lib/cms.functions";
import { PRODUCTS } from "@/lib/products";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";

function MegaMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/mega">
      <button className="text-muted-foreground hover:text-foreground transition-colors py-5">{label}</button>
      <div className="invisible opacity-0 group-hover/mega:visible group-hover/mega:opacity-100 transition-all absolute left-1/2 -translate-x-1/2 top-full z-50">
        <div className="mt-1 rounded-2xl border bg-popover p-5 shadow-2xl">{children}</div>
      </div>
    </div>
  );
}


export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchMenu = useServerFn(listMenuItems);
  const { data: menu = [] } = useQuery({ queryKey: ["cms-menu"], queryFn: () => fetchMenu() });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const header = menu.filter((m) => m.location === "header");

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/50">
      <div className="max-w-7xl mx-auto flex items-center h-16 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="DigiCRM AI" width={36} height={36} className="h-9 w-9 rounded-xl shadow-elegant" />
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-tight" style={{ fontFamily: "var(--font-display)" }}>DigiCRM AI</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Enterprise</span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 mx-auto text-sm">
          <MegaMenu label="Products">
            <div className="grid grid-cols-2 gap-1 w-[520px]">
              {PRODUCTS.map((p) => (
                <Link key={p.slug} to="/products/$slug" params={{ slug: p.slug }} className="rounded-lg p-3 hover:bg-muted transition-colors">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.tagline}</div>
                </Link>
              ))}
              <Link to="/products" className="col-span-2 rounded-lg p-3 text-sm font-medium text-primary hover:bg-muted">
                See the full suite →
              </Link>
            </div>
          </MegaMenu>
          <MegaMenu label="Industries">
            <div className="grid grid-cols-4 gap-4 w-[860px]">
              {INDUSTRY_GROUPS.map((g) => (
                <div key={g.slug}>
                  <Link to="/industries/$group" params={{ group: g.slug }} className="text-xs font-bold uppercase tracking-wide text-primary">
                    {g.name}
                  </Link>
                  <div className="mt-2 flex flex-col gap-1">
                    {g.children.map((c) => (
                      <Link
                        key={c.slug}
                        to="/industries/$group/$slug"
                        params={{ group: g.slug, slug: c.slug }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </MegaMenu>
          {header.map((m) => (
            <Link key={m.id} to={m.url} className="text-muted-foreground hover:text-foreground transition-colors">
              {m.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm"><Link to="/dashboard">Open app <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/auth">Start free trial</Link></Button>
            </>
          )}
          <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col p-4 gap-1">
            {header.map((m) => (
              <Link key={m.id} to={m.url} onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-md text-sm hover:bg-muted">{m.label}</Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
