// Server-side ticket mutations. tenant_id is ALWAYS derived from the caller's
// verified membership — the client's tenant hint is validated against
// tenant_members before any insert. Callers cannot forge tenant_id via payload.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createTicketSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  urgency: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  requester_email: z.string().trim().email().max(255),
  requester_name: z.string().trim().max(200).optional().nullable(),
  industryGroup: z.string().trim().max(60).nullable().optional(),
});

const replySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
  isPublic: z.boolean().default(true),
});

async function resolveTenantForCaller(
  supabase: { from: (t: string) => unknown },
  userId: string,
  requested: string | null | undefined,
): Promise<string | null> {
  const q = (supabase.from("tenant_members") as unknown as {
    select: (c: string) => { eq: (col: string, val: string) => Promise<{ data: { tenant_id: string }[] | null; error: { message: string } | null }> };
  }).select("tenant_id").eq("user_id", userId);
  const { data: memberships, error } = await q;
  if (error) throw new Error("Membership lookup failed");
  const owned = new Set((memberships ?? []).map((m) => m.tenant_id));
  if (requested && owned.has(requested)) return requested;
  if (owned.size === 1) return [...owned][0];
  return null;
}

export const createTicketFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createTicketSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tenantId = await resolveTenantForCaller(supabase, userId, data.tenantId ?? null);
    if (!tenantId) {
      throw new Error(
        "You are not assigned to a workspace yet, so this ticket can't be filed. Please ask your administrator to add you to a workspace.",
      );
    }

    // Industry tag is validated server-side against the caller's granted
    // industries; users restricted to one CRM cannot file into another.
    let industryGroup: string | null = data.industryGroup ?? null;
    if (industryGroup) {
      const { data: access } = await (supabase.from("user_industry_access") as unknown as {
        select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: { industry_group: string }[] | null }> };
      }).select("industry_group").eq("user_id", userId);
      const granted = (access ?? []).map((a) => a.industry_group);
      if (granted.length > 0 && !granted.includes(industryGroup)) {
        throw new Error("You do not have access to that industry workspace.");
      }
    }

    const { data: row, error } = await supabase
      .from("support_tickets")
      .insert({
        industry_group: industryGroup,
        tenant_id: tenantId, // server-derived — payload value is only accepted after membership check
        subject: data.subject,
        description: data.description ?? null,
        priority: data.priority,
        urgency: data.urgency,
        channel: "portal",
        requester_email: data.requester_email,
        requester_name: data.requester_name ?? null,
        created_by: userId,
      })
      .select("id, ticket_number, tenant_id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const createTicketReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => replySchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    // RLS on ticket_replies re-verifies tenant membership via the parent
    // ticket's tenant_id, so a forged ticketId cannot bypass isolation.
    const { data: row, error } = await supabase
      .from("ticket_replies")
      .insert({
        ticket_id: data.ticketId,
        body: data.body,
        is_public: data.isPublic,
        author_id: userId,
        author_email: (claims as { email?: string } | null)?.email ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
