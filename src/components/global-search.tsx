import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCircle, Building2, CheckSquare, LayoutDashboard, KanbanSquare, Sparkles, BarChart3, Bell, Settings, FileText, ScrollText } from "lucide-react";
import { escapePostgrestFilterValue } from "@/lib/utils";

interface Hit { id: string; label: string; sub?: string; route: string; }
interface Results { leads: Hit[]; contacts: Hit[]; companies: Hit[]; tasks: Hit[]; }
const empty: Results = { leads: [], contacts: [], companies: [], tasks: [] };

const shortcuts = [
  { label: "Dashboard", route: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", route: "/leads", icon: Users },
  { label: "Contacts", route: "/contacts", icon: UserCircle },
  { label: "Companies", route: "/companies", icon: Building2 },
  { label: "Pipeline", route: "/pipeline", icon: KanbanSquare },
  { label: "Tasks", route: "/tasks", icon: CheckSquare },
  { label: "AI Assistant", route: "/ai", icon: Sparkles },
  { label: "Proposals", route: "/proposals", icon: FileText },
  { label: "Reports", route: "/reports", icon: BarChart3 },
  { label: "Audit Logs", route: "/audit-logs", icon: ScrollText },
  { label: "Notifications", route: "/notifications", icon: Bell },
  { label: "Settings", route: "/settings", icon: Settings },
];

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(empty);

  useEffect(() => {
    if (!open) { setQ(""); setResults(empty); }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(empty); return; }
    const like = `%${escapePostgrestFilterValue(term)}%`;
    let cancelled = false;
    (async () => {
      const [l, c, co, t] = await Promise.all([
        supabase.from("leads").select("id, company_name, contact_person, email").is("deleted_at", null)
          .or(`company_name.ilike.${like},contact_person.ilike.${like},email.ilike.${like}`).limit(5),
        supabase.from("contacts").select("id, first_name, last_name, email").is("deleted_at", null)
          .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`).limit(5),
        supabase.from("companies").select("id, name, industry").is("deleted_at", null)
          .or(`name.ilike.${like},industry.ilike.${like},city.ilike.${like}`).limit(5),
        supabase.from("tasks").select("id, title, status").is("deleted_at", null)
          .ilike("title", like).limit(5),
      ]);
      if (cancelled) return;
      setResults({
        leads: (l.data ?? []).map(r => ({ id: r.id, label: r.company_name, sub: r.contact_person ?? r.email ?? undefined, route: "/leads" })),
        contacts: (c.data ?? []).map(r => ({ id: r.id, label: `${r.first_name} ${r.last_name ?? ""}`.trim(), sub: r.email ?? undefined, route: "/contacts" })),
        companies: (co.data ?? []).map(r => ({ id: r.id, label: r.name, sub: r.industry ?? undefined, route: "/companies" })),
        tasks: (t.data ?? []).map(r => ({ id: r.id, label: r.title, sub: r.status, route: "/tasks" })),
      });
    })();
    return () => { cancelled = true; };
  }, [q]);

  const go = (route: string) => { onOpenChange(false); navigate({ to: route }); };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search leads, contacts, companies, tasks or jump to a page..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {q.length < 2 && (
          <CommandGroup heading="Jump to">
            {shortcuts.map(s => (
              <CommandItem key={s.route} onSelect={() => go(s.route)}>
                <s.icon className="mr-2 h-4 w-4" /> {s.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.leads.length > 0 && (
          <CommandGroup heading="Leads">
            {results.leads.map(h => (
              <CommandItem key={h.id} onSelect={() => go(h.route)}>
                <Users className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col"><span>{h.label}</span>{h.sub && <span className="text-xs text-muted-foreground">{h.sub}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.contacts.length > 0 && <><CommandSeparator />
          <CommandGroup heading="Contacts">
            {results.contacts.map(h => (
              <CommandItem key={h.id} onSelect={() => go(h.route)}>
                <UserCircle className="mr-2 h-4 w-4 text-info" />
                <div className="flex flex-col"><span>{h.label}</span>{h.sub && <span className="text-xs text-muted-foreground">{h.sub}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup></>}
        {results.companies.length > 0 && <><CommandSeparator />
          <CommandGroup heading="Companies">
            {results.companies.map(h => (
              <CommandItem key={h.id} onSelect={() => go(h.route)}>
                <Building2 className="mr-2 h-4 w-4 text-warning" />
                <div className="flex flex-col"><span>{h.label}</span>{h.sub && <span className="text-xs text-muted-foreground">{h.sub}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup></>}
        {results.tasks.length > 0 && <><CommandSeparator />
          <CommandGroup heading="Tasks">
            {results.tasks.map(h => (
              <CommandItem key={h.id} onSelect={() => go(h.route)}>
                <CheckSquare className="mr-2 h-4 w-4 text-success" />
                <div className="flex flex-col"><span>{h.label}</span>{h.sub && <span className="text-xs text-muted-foreground capitalize">{h.sub}</span>}</div>
              </CommandItem>
            ))}
          </CommandGroup></>}
      </CommandList>
    </CommandDialog>
  );
}
