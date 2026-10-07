import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
export function useRealtimeTable(
  _table: string,
  invalidateKeys: QueryKey[],
  intervalMs = 30_000,
) {
  const qc = useQueryClient();
  const keysRef = useRef(invalidateKeys);
  keysRef.current = invalidateKeys;

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      for (const key of keysRef.current) {
        qc.invalidateQueries({ queryKey: key });
      }
    };

    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [qc, intervalMs]);
}