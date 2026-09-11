import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check } from "lucide-react";
import { useRealtimeTable } from "@/lib/use-realtime-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  link: string | null;
};

async function fetchNotifs(): Promise<Notif[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, is_read, created_at, link")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Notif[];
}

export function NotificationsButton() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: notifs = [] } = useQuery({ queryKey: ["notifications-panel"], queryFn: fetchNotifs });
  useRealtimeTable("notifications", [["notifications-panel"]]);
  const unread = notifs.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    qc.invalidateQueries({ queryKey: ["notifications-panel"] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up</div>
          ) : notifs.map((n) => (
            <div key={n.id} className={`p-3 border-b last:border-b-0 hover:bg-muted/50 ${!n.is_read ? "bg-primary/5" : ""}`}>
              <div className="flex items-start gap-2">
                {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t">
          <Link to="/notifications" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full text-xs">View all</Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Ensure fresh unread badge on mount even before realtime kicks in
export function useSyncNotifications() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["notifications-panel"] });
  }, [qc]);
}
