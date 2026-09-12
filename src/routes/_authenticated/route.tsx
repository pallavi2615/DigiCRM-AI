import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }

    // Optional: Yahan token ko verify karne ke liye backend call kar sakte hain
    // const res = await fetch("http://127.0.0.1:8000/api/auth/me", {
    //   headers: { Authorization: `Bearer ${token}` }
    // });
    // if (!res.ok) {
    //   localStorage.clear();
    //   throw redirect({ to: "/auth" });
    // }

    return { token }; // context mein token available ho gaya
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0">
          <AppTopbar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
