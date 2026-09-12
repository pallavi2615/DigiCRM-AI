import { useNavigate } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, LogOut, User, Moon, Sun } from "lucide-react";
// import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GlobalSearch } from "@/components/global-search";
// import { TenantSwitcher } from "@/components/tenant-switcher";
// import { CrmSwitcher } from "@/components/crm-switcher";

export function AppTopbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user} = useUser();
  const [dark, setDark] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // const handleSignOut = async () => {
  //   await queryClient.cancelQueries();
  //   queryClient.clear();
  //   await supabase.auth.signOut();
  //   toast.success("Signed out");
  //   navigate({ to: "/auth", replace: true });
  // };
  const handleSignOut = async () => {
    // 1. React Query cache clear karo
    await queryClient.cancelQueries();
    queryClient.clear();

    // 2. FastAPI ke tokens localStorage se hatao (Supabase NAHI)
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    // 3. Toast dikhao
    toast.success("Signed out");

    // 4. Login page par bhejo
    navigate({ to: "/auth", replace: true });
  };

  const initials = (user?.full_name || user?.email || "U")
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("");

  // const roleLabel = user?.role[0]?.replace(/_/g, " ") ?? "user";
     const roleLabel = user?.role?.replace(/_/g, " ") ?? "user";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
      <SidebarTrigger />
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="relative flex-1 max-w-lg h-9 flex items-center gap-2 rounded-md bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search leads, contacts, companies, tasks...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="ml-auto flex items-center gap-2">
        {/* <CrmSwitcher />
        <TenantSwitcher /> */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3 h-9">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs gradient-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-medium">{user?.full_name ?? user?.email?.split("@")[0] ?? "User"}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{roleLabel}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm">{user?.email}</span>
                <span className="text-xs text-muted-foreground capitalize">{roleLabel}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
