import { supabase } from "@/integrations/supabase/client";

/**
 * Records a denied RBAC/RLS access attempt into the activities table so
 * admins can review them in Audit Logs. Never throws – logging must not
 * break the caller's flow.
 */
export async function logAccessDenied(
  module: string,
  action: string,
  entityId?: string | null,
  reason?: string,
  tenantId?: string | null,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activities").insert({
      actor_id: user.id,
      entity_type: module,
      entity_id: entityId ?? null,
      action: "access_denied",
      description: `Denied ${action} on ${module}${reason ? ` — ${reason}` : ""}`,
      metadata: { attempted_action: action, tenant_id: tenantId ?? null },
    });
  } catch {
    /* swallow – audit logging is best-effort */
  }
}

/**
 * Records a successful staff-gated access (page view) into the activities
 * table so admins can audit who opened restricted internal-staff modules
 * (lenders, loan products, product catalog) and from which tenant workspace.
 */
export async function logAccessGranted(
  module: string,
  action: string,
  tenantId?: string | null,
  entityId?: string | null,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activities").insert({
      actor_id: user.id,
      entity_type: module,
      entity_id: entityId ?? null,
      action: "access_granted",
      description: `Accessed ${module} (${action})`,
      metadata: { attempted_action: action, tenant_id: tenantId ?? null },
    });
  } catch {
    /* swallow */
  }
}
