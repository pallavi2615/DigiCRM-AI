import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to postgres_changes on a table and invalidate the given
 * React Query keys whenever any row changes. Channel is torn down
 * on unmount to avoid reconnection loops.
 *
 * RLS scopes events per role, so unauthorized users never receive them.
 */
export function useRealtimeTable(table: string, invalidateKeys: QueryKey[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          for (const key of invalidateKeys) {
            qc.invalidateQueries({ queryKey: key });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
