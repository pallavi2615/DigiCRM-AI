import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// ============================================================
// TYPES
// ============================================================

export type Tenant = {
  id: number;
  name: string;
  subdomain: string | null;
  webhook_id: string | null;
  webhook_url: string | null;
  api_key: string | null;
  status: string;
  created_at: string;
};

const ACTIVE_KEY = "digicrm.active_tenant";

// ============================================================
// TENANT INFO — FastAPI
// ============================================================

/**
 * Fetch the current user's tenant info from FastAPI.
 * In FastAPI, one user belongs to exactly one tenant,
 * retrieved via their JWT.
 */
export function useTenantInfo() {
  return useQuery({
    queryKey: ["tenant", "me"],
    queryFn: () => apiFetch<Tenant>("/api/v1/tenant/me"),
  });
}

/**
 * Backwards-compatible alias. Previously returned an array;
 * now returns the single tenant wrapped in an array to avoid
 * breaking consumers that map over it.
 */
export function useMyTenants() {
  const { data, isLoading, refetch } = useTenantInfo();
  return {
    data: data ? [data] : [],
    isLoading,
    refetch,
  };
}

/**
 * Webhook secret — in FastAPI it's the tenant's `api_key`.
 */
export function useTenantWebhookSecret() {
  const { data: tenant } = useTenantInfo();
  return {
    data: tenant?.api_key ?? null,
    isLoading: false,
  };
}

/**
 * Active tenant hook — kept for backward compatibility.
 * Single-tenant-per-user in FastAPI, so `active` always
 * resolves to that tenant.
 */
export function useActiveTenant() {
  const { data: tenant, isLoading, refetch } = useTenantInfo();
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_KEY);
  });

  useEffect(() => {
    if (tenant && typeof window !== "undefined") {
      const id = String(tenant.id);
      setActiveIdState(id);
      localStorage.setItem(ACTIVE_KEY, id);
    }
  }, [tenant]);

  const setActive = (id: string) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(ACTIVE_KEY, id);
  };

  return {
    active: tenant ?? null,
    tenants: tenant ? [tenant] : [],
    setActive,
    loading: isLoading,
    refetch,
  };
}

// ============================================================
// AUTO-FOLLOWUP SETTINGS — FastAPI
// ============================================================

export interface AutoFollowupSettings {
  auto_followup_enabled: boolean;
  default_followup_sequence_id: number | null;
  default_assignee_id: number | null;
}

export function useAutoFollowupSettings() {
  return useQuery({
    queryKey: ["tenant", "auto-followup"],
    queryFn: () =>
      apiFetch<AutoFollowupSettings>("/api/v1/tenant/settings/auto-followup"),
  });
}

export function useUpdateAutoFollowupSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AutoFollowupSettings>) =>
      apiFetch<AutoFollowupSettings>("/api/v1/tenant/settings/auto-followup", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", "auto-followup"] });
    },
  });
}

// ============================================================
// REGENERATE WEBHOOK — FastAPI
// ============================================================

export function useRegenerateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ webhook_id: string; webhook_url: string }>(
        "/api/v1/tenant/regenerate-webhook",
        { method: "POST" }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant", "me"] });
    },
  });
}