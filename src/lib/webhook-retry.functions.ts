import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

type TimelineEntry = {
  ts: string;
  type: string;
  message?: string | null;
  ok?: boolean;
  attempt?: number;
};

async function ensureAdmin(context: any) {
  const { data: role } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  const roles = new Set((role ?? []).map((r: any) => r.role));
  if (!roles.has("admin") && !roles.has("super_admin")) throw new Error("Forbidden");
}

/** Retry a single failed webhook event by its log id. Admin/super_admin only. */
export const retryWebhookEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { logId: string }) => v)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: log, error } = await supabaseAdmin
      .from("inbound_webhooks_log")
      .select("id, tenant_id, event_id, payload, ok, attempts, dead_letter, attempts_log")
      .eq("id", data.logId)
      .maybeSingle();
    if (error || !log) throw new Error("Not found");
    if ((log as any).ok) return { ok: true, duplicate: true };

    const payload = ((log as any).payload ?? {}) as Record<string, unknown>;
    const email = (payload.email ?? payload.Email ?? payload.email_address) as string | undefined;
    const prevLog = (((log as any).attempts_log ?? []) as TimelineEntry[]);
    const now = () => new Date().toISOString();
    const attempts = ((log as any).attempts ?? 1) + 1;

    const appendLog = async (extra: TimelineEntry[], patch: Record<string, unknown>) => {
      await supabaseAdmin.from("inbound_webhooks_log").update({
        ...patch,
        attempts,
        attempts_log: [...prevLog, { ts: now(), type: "manual_retry", attempt: attempts }, ...extra] as unknown as Json,
      } as any).eq("id", (log as any).id);
    };

    if (!email) {
      await appendLog(
        [{ ts: now(), type: "attempt", ok: false, attempt: attempts, message: "email_required" }],
        { ok: false, status_code: 400, message: "email_required", last_error: "email_required" },
      );
      throw new Error("email_required");
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants").select("name, webhook_max_attempts").eq("id", (log as any).tenant_id!).maybeSingle();
    const maxAttempts = ((tenant as any)?.webhook_max_attempts ?? 5) as number;

    const name = ((payload.name ?? payload.full_name ?? payload.Name ?? "") as string).trim();
    const company = ((payload.company ?? payload.company_name ?? (tenant as any)?.name ?? "") as string).trim();

    const { data: lead, error: insErr } = await supabaseAdmin.from("leads").insert({
      tenant_id: (log as any).tenant_id,
      company_name: company || (tenant as any)?.name || "Unknown",
      contact_person: name || email.split("@")[0],
      email,
      phone: (payload.phone ?? payload.mobile ?? null) as string | null,
      source: (payload.source as string) ?? "Webhook (retry)",
      notes: (payload.message ?? payload.notes ?? null) as string | null,
      status: "new",
    }).select("id").single();

    const dead = !!insErr && attempts >= maxAttempts;
    const extra: TimelineEntry[] = [
      { ts: now(), type: "attempt", ok: !insErr, attempt: attempts, message: insErr?.message ?? `lead:${lead?.id}` },
    ];
    if (!insErr) extra.push({ ts: now(), type: "success" });
    if (dead) extra.push({ ts: now(), type: "dead_letter", message: `max ${maxAttempts} attempts` });

    await appendLog(extra, {
      ok: !insErr,
      status_code: insErr ? 500 : 200,
      message: insErr?.message ?? `lead:${lead?.id}`,
      last_error: insErr?.message ?? null,
      next_retry_at: insErr && !dead ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
      dead_letter: dead,
    });

    if (insErr) throw new Error(insErr.message);
    return { ok: true, lead_id: lead?.id };
  });

/** Mark a failed event as dead-letter permanently. Admin only. */
export const markWebhookDeadLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { logId: string; dead: boolean }) => v)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prior } = await supabaseAdmin.from("inbound_webhooks_log")
      .select("attempts_log").eq("id", data.logId).maybeSingle();
    const prevLog = (((prior as any)?.attempts_log ?? []) as TimelineEntry[]);
    const nextLog = [...prevLog, {
      ts: new Date().toISOString(),
      type: data.dead ? "dead_letter" : "reopened",
      message: data.dead ? "manually killed" : "manually reopened",
    }];

    const { error } = await supabaseAdmin.from("inbound_webhooks_log")
      .update({
        dead_letter: data.dead,
        next_retry_at: data.dead ? null : new Date(Date.now() + 60_000).toISOString(),
        attempts_log: nextLog as unknown as Json,
      } as any)
      .eq("id", data.logId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update per-tenant webhook retry config. Admin only. */
export const updateWebhookRetryConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { tenantId: string; maxAttempts: number; baseMinutes: number; factor: number }) => v)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    if (data.maxAttempts < 1 || data.maxAttempts > 20) throw new Error("maxAttempts 1..20");
    if (data.baseMinutes < 1 || data.baseMinutes > 1440) throw new Error("baseMinutes 1..1440");
    if (data.factor < 1 || data.factor > 10) throw new Error("factor 1..10");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenants").update({
      webhook_max_attempts: data.maxAttempts,
      webhook_backoff_base_minutes: data.baseMinutes,
      webhook_backoff_factor: data.factor,
    } as any).eq("id", data.tenantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
