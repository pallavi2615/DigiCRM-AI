import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import { createHmac, timingSafeEqual } from "crypto";

function verifyHmac(secret: string, body: string, sig: string | null): boolean {
  if (!sig) return false;
  const clean = sig.replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(clean, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

type TimelineEntry = {
  ts: string;
  type: "received" | "hmac_ok" | "hmac_fail" | "secret_ok" | "secret_fail"
      | "duplicate" | "attempt" | "success" | "dead_letter" | "reopened" | "manual_retry";
  message?: string | null;
  ok?: boolean;
  attempt?: number;
};

function backoffMinutes(attempt: number, base: number, factor: number): number {
  // attempt is 1-indexed. e.g. base=1, factor=3 → 1,3,9,27,...
  return Math.max(1, Math.round(base * Math.pow(factor, attempt - 1)));
}

export const Route = createFileRoute("/api/public/inbound/leads/$tenantSlug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "content-type, x-webhook-secret, x-webhook-signature, x-webhook-event-id",
        },
      }),
      POST: async ({ request, params }) => {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "content-type": "application/json",
        };
        const provided = request.headers.get("x-webhook-secret") ?? "";
        const signature = request.headers.get("x-webhook-signature");
        const headerEventId = request.headers.get("x-webhook-event-id");
        const bodyText = await request.text();
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(bodyText); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: cors });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("id, name, webhook_hmac_enabled, is_active, webhook_max_attempts, webhook_backoff_base_minutes, webhook_backoff_factor")
          .eq("slug", params.tenantSlug)
          .maybeSingle();

        if (!tenant || !tenant.is_active) {
          return new Response(JSON.stringify({ error: "tenant_not_found" }), { status: 404, headers: cors });
        }

        // Load the webhook secret from the admin-only table (RLS bypassed via service role).
        const { data: secretRow } = await supabaseAdmin
          .from("tenant_webhook_secrets")
          .select("webhook_secret")
          .eq("tenant_id", tenant.id)
          .maybeSingle();
        const webhookSecret = secretRow?.webhook_secret ?? null;

        const maxAttempts = (tenant as any).webhook_max_attempts ?? 5;
        const base = (tenant as any).webhook_backoff_base_minutes ?? 1;
        const factor = Number((tenant as any).webhook_backoff_factor ?? 3);

        const payloadJson = body as unknown as Json;
        const eventId = headerEventId || (typeof body.event_id === "string" ? body.event_id : null);
        const now = () => new Date().toISOString();
        const received: TimelineEntry = { ts: now(), type: "received", message: eventId ? `event_id=${eventId}` : "no event_id" };

        // HMAC / secret auth
        const hmacOk = tenant.webhook_hmac_enabled && webhookSecret
          ? verifyHmac(webhookSecret, bodyText, signature)
          : false;
        const secretOk = !!provided && !!webhookSecret && provided === webhookSecret;
        const authed = tenant.webhook_hmac_enabled ? hmacOk : secretOk;


        if (!authed) {
          const failEntry: TimelineEntry = tenant.webhook_hmac_enabled
            ? { ts: now(), type: "hmac_fail", message: signature ? "signature_mismatch" : "signature_missing" }
            : { ts: now(), type: "secret_fail", message: "invalid_secret" };
          await supabaseAdmin.from("inbound_webhooks_log").insert({
            tenant_id: tenant.id, source: "webhook", ok: false, status_code: 401,
            message: tenant.webhook_hmac_enabled ? "invalid_hmac" : "unauthorized",
            payload: payloadJson,
            attempts_log: [received, failEntry] as unknown as Json,
          } as any);
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
        }

        const authEntry: TimelineEntry = tenant.webhook_hmac_enabled
          ? { ts: now(), type: "hmac_ok" }
          : { ts: now(), type: "secret_ok" };

        // Idempotency
        let existing: { id: string; attempts: number; ok: boolean; attempts_log: TimelineEntry[] | null } | null = null;
        if (eventId) {
          const { data: prior } = await supabaseAdmin
            .from("inbound_webhooks_log")
            .select("id, ok, message, attempts, attempts_log")
            .eq("tenant_id", tenant.id)
            .eq("event_id", eventId)
            .maybeSingle();
          if (prior?.ok) {
            const log = ((prior as any).attempts_log ?? []) as TimelineEntry[];
            const nextLog = [...log, { ts: now(), type: "duplicate", message: "already succeeded" } as TimelineEntry];
            await supabaseAdmin.from("inbound_webhooks_log")
              .update({ attempts_log: nextLog as unknown as Json } as any)
              .eq("id", (prior as any).id);
            return new Response(JSON.stringify({ ok: true, duplicate: true, message: (prior as any).message }), { status: 200, headers: cors });
          }
          if (prior) existing = prior as any;
        }

        const email = (body.email ?? body.Email ?? body.email_address) as string | undefined;
        const name = ((body.name ?? body.full_name ?? body.Name ?? "") as string).trim();
        const company = ((body.company ?? body.company_name ?? tenant.name) as string).trim();

        if (!email) {
          await recordAttempt(supabaseAdmin, tenant.id, eventId, existing, false, 400, "email_required", payloadJson,
            [received, authEntry], maxAttempts, base, factor);
          return new Response(JSON.stringify({ error: "email_required" }), { status: 400, headers: cors });
        }

        const { data: lead, error } = await supabaseAdmin.from("leads").insert({
          tenant_id: tenant.id,
          company_name: company || tenant.name,
          contact_person: name || email.split("@")[0],
          email,
          phone: (body.phone ?? body.mobile ?? null) as string | null,
          source: (body.source as string) ?? "Webhook",
          notes: (body.message ?? body.notes ?? null) as string | null,
          status: "new",
        }).select("id").single();

        if (lead && !error) {
          try {
            const { trackInboundLead } = await import("@/lib/lead-tracking.server");
            const u = new URL(request.url);
            await trackInboundLead(
              supabaseAdmin as never,
              {
                slug: ((body.channel as string) ?? "zapier").toLowerCase(),
                name: (body.channel as string) ?? "Zapier",
                kind: "zapier",
                groupSlug: u.searchParams.get("group"),
                packSlug: u.searchParams.get("pack"),
              },
              (body.campaign as string) ?? null,
              {
                tenantId: tenant.id,
                leadId: lead.id,
                title: company || name || email,
                contactName: name,
                contactEmail: email,
                contactPhone: (body.phone ?? body.mobile ?? null) as string | null,
                externalRef: eventId,
              },
            );
          } catch { /* attribution is best-effort */ }
        }



        await recordAttempt(
          supabaseAdmin, tenant.id, eventId, existing,
          !error, error ? 500 : 200,
          error?.message ?? (lead ? `lead:${lead.id}` : null),
          payloadJson,
          [received, authEntry],
          maxAttempts, base, factor,
        );

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
        return new Response(JSON.stringify({ ok: true, lead_id: lead?.id }), { status: 200, headers: cors });
      },
    },
  },
});

async function recordAttempt(
  admin: any,
  tenantId: string,
  eventId: string | null,
  existing: { id: string; attempts: number; attempts_log: TimelineEntry[] | null } | null,
  ok: boolean,
  status: number,
  message: string | null,
  payload: Json,
  preLog: TimelineEntry[],
  maxAttempts: number,
  base: number,
  factor: number,
) {
  const now = new Date().toISOString();
  if (existing) {
    const attempts = (existing.attempts ?? 1) + 1;
    const dead = !ok && attempts >= maxAttempts;
    const backoff = backoffMinutes(attempts, base, factor);
    const prevLog = (existing.attempts_log ?? []) as TimelineEntry[];
    const attemptEntry: TimelineEntry = { ts: now, type: "attempt", ok, attempt: attempts, message };
    const extra: TimelineEntry[] = [attemptEntry];
    if (ok) extra.push({ ts: now, type: "success", message });
    if (dead) extra.push({ ts: now, type: "dead_letter", message: `max ${maxAttempts} attempts` });
    await admin.from("inbound_webhooks_log").update({
      ok, status_code: status, message, payload,
      attempts, last_error: ok ? null : message,
      next_retry_at: ok || dead ? null : new Date(Date.now() + backoff * 60_000).toISOString(),
      dead_letter: dead,
      attempts_log: [...prevLog, ...extra] as unknown as Json,
    }).eq("id", existing.id);
    return;
  }
  const attempts = 1;
  const dead = !ok && attempts >= maxAttempts;
  const backoff = backoffMinutes(attempts, base, factor);
  const attemptEntry: TimelineEntry = { ts: now, type: "attempt", ok, attempt: 1, message };
  const log: TimelineEntry[] = [...preLog, attemptEntry];
  if (ok) log.push({ ts: now, type: "success", message });
  if (dead) log.push({ ts: now, type: "dead_letter", message: `max ${maxAttempts} attempts` });
  await admin.from("inbound_webhooks_log").insert({
    tenant_id: tenantId, source: "webhook", ok, status_code: status,
    message, payload, event_id: eventId, attempts,
    last_error: ok ? null : message,
    next_retry_at: ok || dead ? null : new Date(Date.now() + backoff * 60_000).toISOString(),
    dead_letter: dead,
    attempts_log: log as unknown as Json,
  });
}
