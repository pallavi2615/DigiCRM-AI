import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import { trackInboundLead } from "@/lib/lead-tracking.server";


type FieldDatum = { name?: string; values?: string[] };

function pick(fields: FieldDatum[], keys: string[]): string | null {
  for (const key of keys) {
    const hit = fields.find((f) => (f.name ?? "").toLowerCase().includes(key));
    const val = hit?.values?.[0];
    if (val) return String(val).trim();
  }
  return null;
}

async function loadTenant(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, name, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant || !tenant.is_active) return { supabaseAdmin, tenant: null, secret: null };
  const { data: secretRow } = await supabaseAdmin
    .from("tenant_webhook_secrets")
    .select("webhook_secret")
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  return { supabaseAdmin, tenant, secret: secretRow?.webhook_secret ?? null };
}

export const Route = createFileRoute("/api/public/inbound/meta/$tenantSlug")({
  server: {
    handlers: {
      // Meta webhook subscription verification (Facebook & Instagram Lead Ads)
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const { tenant, secret } = await loadTenant(params.tenantSlug);
        if (!tenant) return new Response("tenant_not_found", { status: 404 });
        if (mode === "subscribe" && secret && token === secret) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("forbidden", { status: 403 });
      },

      POST: async ({ request, params }) => {
        const headers = { "content-type": "application/json" };
        const bodyText = await request.text();
        let body: any = {};
        try { body = JSON.parse(bodyText); } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
        }

        const { supabaseAdmin, tenant, secret } = await loadTenant(params.tenantSlug);
        if (!tenant) return new Response(JSON.stringify({ error: "tenant_not_found" }), { status: 404, headers });

        const provided = request.headers.get("x-webhook-secret") ?? new URL(request.url).searchParams.get("token") ?? "";
        if (!secret || provided !== secret) {
          await supabaseAdmin.from("inbound_webhooks_log").insert({
            tenant_id: tenant.id, source: "meta", ok: false, status_code: 401,
            message: "unauthorized", payload: body as Json,
          } as never);
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
        }

        // Normalise: accept raw Meta leadgen payloads and Zapier/Make forwarded shapes.
        const entries: any[] = Array.isArray(body.entry) ? body.entry : [];
        const candidates: { platform: string; fields: FieldDatum[]; formName?: string | null }[] = [];

        for (const entry of entries) {
          for (const change of entry.changes ?? []) {
            const value = change.value ?? {};
            const platform = change.field === "leadgen" ? (value.platform ?? "facebook") : String(change.field ?? "meta");
            candidates.push({
              platform,
              fields: (value.field_data ?? []) as FieldDatum[],
              formName: value.form_name ?? value.form_id ?? null,
            });
          }
        }
        if (candidates.length === 0 && (body.field_data || body.email || body.full_name)) {
          candidates.push({
            platform: String(body.platform ?? "facebook"),
            fields: (body.field_data ?? [
              { name: "full_name", values: [body.full_name ?? body.name] },
              { name: "email", values: [body.email] },
              { name: "phone_number", values: [body.phone] },
            ]) as FieldDatum[],
            formName: body.form_name ?? null,
          });
        }

        // Where inbound Meta leads land in the pack pipeline. Defaults to the
        // lending pack; override per form with ?group=...&pack=...
        const url2 = new URL(request.url);
        const groupSlug = url2.searchParams.get("group") ?? "financial-services";
        const packSlug = url2.searchParams.get("pack") ?? "lending";

        let inserted = 0;
        const errors: string[] = [];
        for (const c of candidates) {
          const email = pick(c.fields, ["email"]);
          const phone = pick(c.fields, ["phone", "mobile"]);
          const name = pick(c.fields, ["full_name", "name"]);
          const company = pick(c.fields, ["company", "organisation", "organization"]);
          const amountRaw = pick(c.fields, ["amount", "loan", "budget", "value"]);
          const amount = amountRaw ? Number(String(amountRaw).replace(/[^\d.]/g, "")) : null;
          const city = pick(c.fields, ["city", "location"]);
          if (!email && !phone) { errors.push("row missing email and phone"); continue; }
          const instagram = c.platform === "instagram";
          const sourceLabel = instagram ? "Instagram Lead Ads" : "Facebook Lead Ads";
          const { data: leadRow, error } = await supabaseAdmin.from("leads").insert({
            tenant_id: tenant.id,
            company_name: company || name || tenant.name,
            contact_person: name || email?.split("@")[0] || phone,
            email,
            phone,
            city,
            estimated_value: Number.isFinite(amount as number) ? amount : null,
            source: sourceLabel,
            campaign: c.formName ?? null,
            notes: c.formName ? `Meta form: ${c.formName}` : null,
            status: "new",
          } as never).select("id").maybeSingle();
          if (error || !leadRow) { errors.push(error?.message ?? "insert failed"); continue; }
          inserted += 1;
          try {
            await trackInboundLead(
              supabaseAdmin as never,
              {
                slug: instagram ? "instagram-lead-ads" : "facebook-lead-ads",
                name: sourceLabel,
                kind: "meta",
                groupSlug,
                packSlug,
              },
              c.formName,
              {
                tenantId: tenant.id,
                leadId: (leadRow as { id: string }).id,
                title: company || name || sourceLabel,
                contactName: name,
                contactEmail: email,
                contactPhone: phone,
                value: Number.isFinite(amount as number) ? amount : null,
                notes: c.formName ? `Meta form: ${c.formName}` : null,
                externalRef: c.formName ?? null,
              },
            );
          } catch (e) {
            errors.push(`attribution failed: ${(e as Error).message}`);
          }
        }


        const ok = inserted > 0 && errors.length === 0;
        await supabaseAdmin.from("inbound_webhooks_log").insert({
          tenant_id: tenant.id,
          source: "meta",
          ok,
          status_code: ok ? 200 : inserted > 0 ? 207 : 400,
          message: `${inserted} lead(s) imported${errors.length ? ` — ${errors.slice(0, 3).join("; ")}` : ""}`,
          payload: body as Json,
        } as never);

        return new Response(JSON.stringify({ ok, inserted, errors }), {
          status: inserted > 0 ? 200 : 400,
          headers,
        });
      },
    },
  },
});
