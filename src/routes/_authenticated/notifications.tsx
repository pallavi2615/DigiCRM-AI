import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — DigiCRM AI" }] }),
  component: NotificationsPage,
});

interface N { id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string; }

function NotificationsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: items, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as N[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, user]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = (items ?? []).filter(n => !n.is_read).length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">{unread} unread of {items?.length ?? 0}</p>
        </div>
        {unread > 0 && <Button variant="outline" size="sm" onClick={() => markAll.mutate()}><Check className="mr-2 h-4 w-4" /> Mark all read</Button>}
      </div>

      {isLoading && <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>}
      {!isLoading && items?.length === 0 && (
        <Card className="shadow-card"><CardContent className="text-center py-16">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {items?.map(n => (
          <Card key={n.id} className={`shadow-sm ${!n.is_read ? "border-primary/40 bg-primary/[0.02]" : ""}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={`h-2 w-2 rounded-full mt-2 ${n.is_read ? "bg-muted-foreground/30" : "bg-primary"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{n.title}</p>
                {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <Button variant="ghost" size="sm" onClick={() => markRead.mutate(n.id)}>Mark read</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
