import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/lib/plan";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  plan: Plan;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  industry: string | null;
  custom_domain: string | null;
  is_active: boolean;
  owner_id: string | null;
  created_at: string;
};

const ACTIVE_KEY = "digicrm.active_tenant";

export function useMyTenants() {
  return useQuery({
    queryKey: ["my-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, name, plan, tagline, logo_url, favicon_url, primary_color, accent_color, industry, custom_domain, is_active, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
  });
}

/**
 * Admin-only fetch of a tenant's webhook secret. Returns null for non-admin
 * callers because the underlying `tenant_webhook_secrets` table restricts
 * reads to super_admin / admin via RLS.
 */
export function useTenantWebhookSecret(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["tenant-webhook-secret", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_webhook_secrets")
        .select("webhook_secret")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) return null;
      return data?.webhook_secret ?? null;
    },
  });
}


export function useActiveTenant() {
  const { data: tenants = [], isLoading } = useMyTenants();
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_KEY);
  });

  useEffect(() => {
    if (!isLoading && tenants.length && !tenants.find((t) => t.id === activeId)) {
      const first = tenants[0]?.id ?? null;
      setActiveIdState(first);
      if (first && typeof window !== "undefined") localStorage.setItem(ACTIVE_KEY, first);
    }
  }, [tenants, isLoading, activeId]);

  const setActive = (id: string) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
  };

  const active = tenants.find((t) => t.id === activeId) ?? tenants[0] ?? null;
  return { active, tenants, setActive, loading: isLoading };
}
