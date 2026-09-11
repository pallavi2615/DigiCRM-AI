/**
 * Industry pack AI agents.
 *
 * Every pack ships its own agents (see `src/lib/industry-packs.ts`). The agent
 * runs server-side, is grounded only in records the caller may read (RLS), and
 * each run is logged to `public.pack_agent_runs`.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPack } from "./industry-packs";
import { mergePack } from "./pack-merge";


type AgentInput = {
  group: string;
  slug: string;
  agentKey: string;
  recordId?: string | null;
  question?: string;
};

export const runPackAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as AgentInput;
    if (!d?.group || !d?.slug || !d?.agentKey) throw new Error("Pick an agent to run");
    return d;
  })
  .handler(async ({ data, context }) => {
    const basePack = getPack(data.group, data.slug);
    if (!basePack) throw new Error("Unknown industry pack");

    // Admin overrides from the pack CMS (/admin-packs) win over the built-in pack.
    const { data: override } = await context.supabase
      .from("pack_configs")
      .select("record_label, record_label_plural, party_label, value_label, stages, won_stages, fields, agents")
      .eq("group_slug", data.group)
      .eq("pack_slug", data.slug)
      .maybeSingle();
    const pack = mergePack(basePack, override as never);

    const agent = pack.agents.find((a) => a.key === data.agentKey);
    if (!agent) throw new Error("Unknown agent");


    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this workspace.");

    // Grounding: one record when selected, otherwise the pack's open pipeline.
    let grounding = "";
    if (data.recordId) {
      const { data: rec } = await context.supabase
        .from("pack_records")
        .select("title, stage, value, currency, priority, contact_name, contact_email, contact_phone, city, source, fields, notes, next_action_at, created_at")
        .eq("id", data.recordId)
        .maybeSingle();
      grounding = rec ? `Record under review:\n${JSON.stringify(rec, null, 2)}` : "No readable record was found for the given id.";
    } else {
      const { data: rows } = await context.supabase
        .from("pack_records")
        .select("title, stage, value, priority, city, next_action_at, created_at")
        .eq("group_slug", data.group)
        .eq("pack_slug", data.slug)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(40);
      grounding = `Open ${pack.recordLabelPlural.toLowerCase()} (most recent 40):\n${JSON.stringify(rows ?? [], null, 2)}`;
    }

    const system = [
      `You are a DigiCRM AI industry agent working inside the "${pack.name}" pack (${pack.groupName}).`,
      `In this pack a deal is called a ${pack.recordLabel}, the counterparty is a ${pack.partyLabel}, and the value field means "${pack.valueLabel}".`,
      `Pipeline stages, in order: ${pack.stages.join(" → ")}.`,
      `Custom fields available: ${pack.fields.map((f) => `${f.label} (${f.key})`).join(", ")}.`,
      `Verification checks available in DigiVerify: ${pack.verifications.join(", ")}.`,
      agent.instruction,
      "Answer in compact markdown. Use bullet points. Never exceed 250 words.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${grounding}\n\n${data.question?.trim() || `Run the ${agent.label} and tell me what to do next.`}` },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("The AI is rate limited right now — try again in a minute.");
      if (res.status === 402) throw new Error("AI credits are exhausted. Add credits to keep using industry agents.");
      throw new Error(`Agent failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const output = json.choices?.[0]?.message?.content ?? "The agent returned an empty response.";

    await context.supabase.from("pack_agent_runs").insert({
      group_slug: data.group,
      pack_slug: data.slug,
      agent_key: agent.key,
      record_id: data.recordId ?? null,
      input: { question: data.question ?? null, scope: data.recordId ? "record" : "pipeline" },
      output,
      created_by: context.userId,
    });

    return { agent: agent.label, output };
  });
