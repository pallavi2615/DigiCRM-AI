import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPack } from "@/lib/industry-packs";
import { mergePack, type PackOverride } from "@/lib/pack-merge";

interface Msg { role: "user" | "assistant" | "system"; content: string }
interface EntityRef { type: "leads" | "contacts" | "companies"; id: string }
interface PackRef { group: string; slug: string }

// export const aiChat = createServerFn({ method: "POST" })
//   .middleware([requireSupabaseAuth])
//   .inputValidator((data: unknown) => {
//     const d = data as { messages: Msg[]; context?: EntityRef[]; pack?: PackRef; tenantId?: string | null };
//     if (!d?.messages || !Array.isArray(d.messages)) throw new Error("messages required");
//     if (d.context && !Array.isArray(d.context)) throw new Error("context must be array");
//     return d;
//   })

//   .handler(async ({ data, context }) => {
//     // Admins get actionable configuration diagnostics; everyone else gets a
//     // friendly message. Keys are never returned to the client.
//     const isAdmin = async () => {
//       const { data: r } = await context.supabase
//         .from("user_roles").select("role").eq("user_id", context.userId);
//       return (r ?? []).some((x: { role: string }) => x.role === "super_admin" || x.role === "admin");
//     };
//     const fail = async (adminMsg: string, userMsg: string) => {
//       throw new Error((await isAdmin()) ? adminMsg : userMsg);
//     };

//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) {
//       await fail(
//         "AI is not configured: the workspace AI key is missing. Enable AI in your backend settings.",
//         "The AI assistant is not switched on for this workspace yet. Please ask your administrator to enable it.",
//       );
//     }



//     const systemMsg: Msg = {
//       role: "system",
//       content: "You are DigiCRM AI, an expert sales assistant. Help users manage leads, draft outreach emails, analyze pipelines, and give concise, actionable sales guidance. Be professional and friendly. Answer in the terminology of the industry pack the user is working in when one is supplied.",
//     };

//     // Industry-pack vocabulary: stages, record naming, custom fields and the
//     // agents configured for the pack, so answers use the vertical's language.
//     const packMsgs: Msg[] = [];
//     if (data.pack?.group && data.pack?.slug) {
//       const basePack = getPack(data.pack.group, data.pack.slug);
//       // Workspace admins retrain the assistant by editing their own pack in
//       // Pack Settings: their override (RLS-scoped to the tenants they belong
//       // to) wins over the built-in vocabulary.
//       const { data: overrideRow } = await context.supabase
//         .from("pack_configs")
//         .select(
//           "group_slug, pack_slug, record_label, record_label_plural, party_label, value_label, stages, won_stages, lost_stages, fields, agents, name, tagline, kpi_labels",
//         )
//         .eq("group_slug", data.pack.group)
//         .eq("pack_slug", data.pack.slug)
//         .order("tenant_id", { ascending: false, nullsFirst: false })
//         .limit(1)
//         .maybeSingle();
//       const p = basePack ? mergePack(basePack, overrideRow as unknown as PackOverride | null) : null;
//       if (p) {
//         packMsgs.push({
//           role: "system",
//           content: [
//             `Industry pack: ${p.name} (${p.groupName}). ${p.tagline}`,
//             `Call one record a "${p.recordLabel}" (plural "${p.recordLabelPlural}"), the counterparty a "${p.partyLabel}", and the deal value the "${p.valueLabel}".`,
//             `Pipeline stages, in order: ${p.stages.join(" → ")}. Won stages: ${p.wonStages.join(", ")}. Lost stages: ${p.lostStages.join(", ") || "none"}.`,
//             `Fields captured on each ${p.recordLabel}: ${p.fields.map((f) => f.label).join(", ") || "none"}.`,
//             `KPIs the team watches: ${p.kpiLabels.join(", ")}.`,
//             p.agents.length ? `Available AI agents: ${p.agents.map((a) => `${a.label} — ${a.description}`).join("; ")}.` : "",
//           ].filter(Boolean).join("\n"),
//         });
//       }
//     }

//     // Workspace-specific training data: a glossary, a preferred tone and
//     // worked question/answer examples the tenant admin maintains for this pack.
//     // RLS keeps a workspace's dataset invisible to everyone outside it.
//     if (data.tenantId && data.pack?.group && data.pack?.slug) {
//       const { data: t } = await context.supabase
//         .from("pack_ai_training")
//         .select("glossary, tone, examples")
//         .eq("tenant_id", data.tenantId)
//         .eq("group_slug", data.pack.group)
//         .eq("pack_slug", data.pack.slug)
//         .maybeSingle();
//       const row = t as { glossary: string | null; tone: string | null; examples: unknown } | null;
//       if (row) {
//         const examples = Array.isArray(row.examples)
//           ? (row.examples as Array<{ question?: string; answer?: string }>)
//           : [];
//         const parts = [
//           row.glossary ? `Workspace glossary (always prefer these terms):\n${row.glossary}` : "",
//           row.tone ? `Preferred tone and style: ${row.tone}` : "",
//           examples.length
//             ? "Worked examples of how this workspace expects answers:\n" +
//               examples
//                 .filter((e) => e?.question && e?.answer)
//                 .map((e) => `Q: ${e.question}\nA: ${e.answer}`)
//                 .join("\n---\n")
//             : "",
//         ].filter(Boolean);
//         if (parts.length) packMsgs.push({ role: "system", content: parts.join("\n\n") });
//       }

//       // Live grounding: a snapshot of this workspace's own applications for
//       // the pack, so answers cite real stages, parties and values rather than
//       // generic examples. RLS keeps it scoped to the caller's workspace.
//       const { data: recs } = await context.supabase
//         .from("pack_records")
//         .select("title, contact_name, stage, value, won, created_at")
//         .eq("tenant_id", data.tenantId)
//         .eq("group_slug", data.pack.group)
//         .eq("pack_slug", data.pack.slug)
//         .order("created_at", { ascending: false })
//         .limit(25);
//       const rows = (recs ?? []) as Array<{ title: string | null; contact_name: string | null; stage: string | null; value: number | null; won: boolean | null }>;
//       if (rows.length) {
//         const byStage = new Map<string, number>();
//         let openValue = 0, wonValue = 0;
//         for (const r of rows) {
//           byStage.set(r.stage ?? "unknown", (byStage.get(r.stage ?? "unknown") ?? 0) + 1);
//           // `won === false` is the default on new records, so a record only counts
//           // as closed-won on its own flag; everything not yet won is open value.
//           if (r.won === true) wonValue += Number(r.value ?? 0);
//           else openValue += Number(r.value ?? 0);

//         }
//         packMsgs.push({
//           role: "system",
//           content: [
//             `Live snapshot of this workspace's ${rows.length} most recent records for this pack.`,
//             `Records per stage: ${[...byStage.entries()].map(([k, v]) => `${k}: ${v}`).join(", ")}.`,
//             `Open value: ${openValue}. Won value: ${wonValue}.`,
//             "Recent records:",
//             rows.slice(0, 12).map((r) => `- ${r.title ?? "Untitled"} · ${r.contact_name ?? "unknown party"} · ${r.stage ?? "no stage"} · ${r.value ?? 0}`).join("\n"),
//             "Use these real records and this pack's vocabulary when answering; never invent records.",
//           ].join("\n"),
//         });
//       }
//     }




//     // Ground the prompt with entity data the user is permitted to read (RLS-scoped).
//     // Any requested-but-not-visible entity is silently dropped AND logged as an
//     // access_denied audit row so admins can see attempts to reference restricted rows.
//     const contextMsgs: Msg[] = [];
//     const requested = data.context ?? [];
//     if (requested.length > 0) {
//       const groups: Record<string, string[]> = { leads: [], contacts: [], companies: [] };
//       for (const r of requested) {
//         if (r?.type && r?.id && groups[r.type]) groups[r.type].push(r.id);
//       }
//       const permitted = new Set<string>();
//       const blocks: string[] = [];
//       for (const t of ["leads", "contacts", "companies"] as const) {
//         if (groups[t].length === 0) continue;
//         const cols =
//           t === "leads" ? "id, company_name, contact_person, email, status, estimated_value, source, notes"
//           : t === "contacts" ? "id, first_name, last_name, email, phone, designation"
//           : "id, name, industry, website, annual_revenue, employee_count";
//         const { data: rows } = await context.supabase.from(t).select(cols).in("id", groups[t]);
//         const list = (rows ?? []) as unknown as Array<{ id: string }>;
//         for (const row of list) {
//           permitted.add(`${t}:${row.id}`);
//           blocks.push(`[${t}] ${JSON.stringify(row)}`);
//         }
//       }
//       // Audit any denied references
//       const denied = requested.filter((r) => !permitted.has(`${r.type}:${r.id}`));
//       if (denied.length > 0) {
//         try {
//           await context.supabase.from("activities").insert(
//             denied.map((d) => ({
//               actor_id: context.userId,
//               entity_type: d.type,
//               entity_id: d.id,
//               action: "access_denied",
//               description: `Denied AI grounding on ${d.type} — row not visible to user`,
//               metadata: { attempted_action: "ai_ground" },
//             })),
//           );
//         } catch { /* best-effort */ }
//       }
//       if (blocks.length > 0) {
//         contextMsgs.push({
//           role: "system",
//           content: "Reference data (only use these records; do not invent or reference anything else):\n" + blocks.join("\n"),
//         });
//       } else if (denied.length > 0) {
//         contextMsgs.push({
//           role: "system",
//           content: "No reference records were accessible to this user. Do not fabricate records; ask the user to select records they own.",
//         });
//       }
//     }

//     const MODEL = "gemini-3.6-flash";

//     const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
//       method: "POST",
//       headers: { 
//         "Content-Type": "application/json",
//         "x-goog-api-key": apiKey 
//       },
//       body: JSON.stringify({
//         model: MODEL,
//         input: data.messages.map(m => ({
//           type: "text",
//           text: m.content
//         })),
//         system_instruction: systemContent
//       }),
//     });


//     if (res.status === 429) throw new Error("The AI assistant is busy right now. Please try again in a moment.");
//     if (res.status === 402) {
//       await fail(
//         "AI credits are exhausted. Add credits to your workspace to continue.",
//         "The workspace has run out of AI credits. Please ask your administrator to top them up.",
//       );
//     }
//     if (res.status === 403) {
//       await fail(
//         "AI access is blocked by a workspace policy or credit limit. Review your AI settings.",
//         "AI access is currently blocked for this workspace. Please contact your administrator.",
//       );
//     }
//     if (!res.ok) {
//       const t = await res.text();
//       await fail(
//         `AI request failed (${res.status}): ${t.slice(0, 300)}`,
//         "The AI assistant could not answer just now. Please try again in a moment.",
//       );
//     }


//     const json = await res.json();
//     const content: string =
//       json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

//     // Usage accounting for the workspace dashboard (best-effort).
//     try {
//       const promptChars = data.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
//       await context.supabase.from("ai_usage_log").insert({
//         tenant_id: data.tenantId ?? null,
//         user_id: context.userId,
//         group_slug: data.pack?.group ?? null,
//         pack_slug: data.pack?.slug ?? null,
//         model: MODEL,
//         prompt_chars: promptChars,
//         response_chars: content.length,
//       });
//     } catch { /* never block an answer on accounting */ }

//     return {
//       content,
//       grounded: contextMsgs.length > 0,
//       permitted_count: contextMsgs.length > 0 ? (contextMsgs[0].content.match(/^\[/gm)?.length ?? 0) : 0,
//     };
//   });


export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as {
  accessToken: string;
  messages: Msg[];
  context?: EntityRef[];
  pack?: PackRef;
  tenantId?: string | null;
};

if (!d.accessToken) {
  throw new Error("Unauthorized: No token provided");
}
    if (!d?.messages || !Array.isArray(d.messages)) throw new Error("messages required");
    if (d.context && !Array.isArray(d.context)) throw new Error("context must be array");
    return d;
  })

  .handler(async ({ data, context }) => {
    const isAdmin = async () => {
      const { data: r } = await context.supabase
        .from("user_roles").select("role").eq("user_id", context.userId);
      return (r ?? []).some((x: { role: string }) => x.role === "super_admin" || x.role === "admin");
    };
    const fail = async (adminMsg: string, userMsg: string) => {
      throw new Error((await isAdmin()) ? adminMsg : userMsg);
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await fail(
        "AI is not configured: GEMINI_API_KEY is missing in backend settings.",
        "The AI assistant is not switched on for this workspace yet. Please ask your administrator to enable it.",
      );
    }

    const systemMsg: Msg = {
      role: "system",
      content: "You are DigiCRM AI, an expert sales assistant. Help users manage leads, draft outreach emails, analyze pipelines, and give concise, actionable sales guidance. Be professional and friendly. Answer in the terminology of the industry pack the user is working in when one is supplied.",
    };

    const packMsgs: Msg[] = [];
    if (data.pack?.group && data.pack?.slug) {
      const basePack = getPack(data.pack.group, data.pack.slug);
      const { data: overrideRow } = await context.supabase
        .from("pack_configs")
        .select(
          "group_slug, pack_slug, record_label, record_label_plural, party_label, value_label, stages, won_stages, lost_stages, fields, agents, name, tagline, kpi_labels",
        )
        .eq("group_slug", data.pack.group)
        .eq("pack_slug", data.pack.slug)
        .order("tenant_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const p = basePack ? mergePack(basePack, overrideRow as unknown as PackOverride | null) : null;
      if (p) {
        packMsgs.push({
          role: "system",
          content: [
            `Industry pack: ${p.name} (${p.groupName}). ${p.tagline}`,
            `Call one record a "${p.recordLabel}" (plural "${p.recordLabelPlural}"), the counterparty a "${p.partyLabel}", and the deal value the "${p.valueLabel}".`,
            `Pipeline stages, in order: ${p.stages.join(" → ")}. Won stages: ${p.wonStages.join(", ")}. Lost stages: ${p.lostStages.join(", ") || "none"}.`,
            `Fields captured on each ${p.recordLabel}: ${p.fields.map((f) => f.label).join(", ") || "none"}.`,
            `KPIs the team watches: ${p.kpiLabels.join(", ")}.`,
            p.agents.length ? `Available AI agents: ${p.agents.map((a) => `${a.label} — ${a.description}`).join("; ")}.` : "",
          ].filter(Boolean).join("\n"),
        });
      }
    }

    if (data.tenantId && data.pack?.group && data.pack?.slug) {
      const { data: t } = await context.supabase
        .from("pack_ai_training")
        .select("glossary, tone, examples")
        .eq("tenant_id", data.tenantId)
        .eq("group_slug", data.pack.group)
        .eq("pack_slug", data.pack.slug)
        .maybeSingle();
      const row = t as { glossary: string | null; tone: string | null; examples: unknown } | null;
      if (row) {
        const examples = Array.isArray(row.examples)
          ? (row.examples as Array<{ question?: string; answer?: string }>)
          : [];
        const parts = [
          row.glossary ? `Workspace glossary (always prefer these terms):\n${row.glossary}` : "",
          row.tone ? `Preferred tone and style: ${row.tone}` : "",
          examples.length
            ? "Worked examples of how this workspace expects answers:\n" +
              examples
                .filter((e) => e?.question && e?.answer)
                .map((e) => `Q: ${e.question}\nA: ${e.answer}`)
                .join("\n---\n")
            : "",
        ].filter(Boolean);
        if (parts.length) packMsgs.push({ role: "system", content: parts.join("\n\n") });
      }

      const { data: recs } = await context.supabase
        .from("pack_records")
        .select("title, contact_name, stage, value, won, created_at")
        .eq("tenant_id", data.tenantId)
        .eq("group_slug", data.pack.group)
        .eq("pack_slug", data.pack.slug)
        .order("created_at", { ascending: false })
        .limit(25);
      const rows = (recs ?? []) as Array<{ title: string | null; contact_name: string | null; stage: string | null; value: number | null; won: boolean | null }>;
      if (rows.length) {
        const byStage = new Map<string, number>();
        let openValue = 0, wonValue = 0;
        for (const r of rows) {
          byStage.set(r.stage ?? "unknown", (byStage.get(r.stage ?? "unknown") ?? 0) + 1);
          if (r.won === true) wonValue += Number(r.value ?? 0);
          else openValue += Number(r.value ?? 0);
        }
        packMsgs.push({
          role: "system",
          content: [
            `Live snapshot of this workspace's ${rows.length} most recent records for this pack.`,
            `Records per stage: ${[...byStage.entries()].map(([k, v]) => `${k}: ${v}`).join(", ")}.`,
            `Open value: ${openValue}. Won value: ${wonValue}.`,
            "Recent records:",
            rows.slice(0, 12).map((r) => `- ${r.title ?? "Untitled"} · ${r.contact_name ?? "unknown party"} · ${r.stage ?? "no stage"} · ${r.value ?? 0}`).join("\n"),
            "Use these real records and this pack's vocabulary when answering; never invent records.",
          ].join("\n"),
        });
      }
    }

    const contextMsgs: Msg[] = [];
    const requested = data.context ?? [];
    if (requested.length > 0) {
      const groups: Record<string, string[]> = { leads: [], contacts: [], companies: [] };
      for (const r of requested) {
        if (r?.type && r?.id && groups[r.type]) groups[r.type].push(r.id);
      }
      const permitted = new Set<string>();
      const blocks: string[] = [];
      for (const t of ["leads", "contacts", "companies"] as const) {
        if (groups[t].length === 0) continue;
        const cols =
          t === "leads" ? "id, company_name, contact_person, email, status, estimated_value, source, notes"
          : t === "contacts" ? "id, first_name, last_name, email, phone, designation"
          : "id, name, industry, website, annual_revenue, employee_count";
        const { data: rows } = await context.supabase.from(t).select(cols).in("id", groups[t]);
        const list = (rows ?? []) as unknown as Array<{ id: string }>;
        for (const row of list) {
          permitted.add(`${t}:${row.id}`);
          blocks.push(`[${t}] ${JSON.stringify(row)}`);
        }
      }
      const denied = requested.filter((r) => !permitted.has(`${r.type}:${r.id}`));
      if (denied.length > 0) {
        try {
          await context.supabase.from("activities").insert(
            denied.map((d) => ({
              actor_id: context.userId,
              entity_type: d.type,
              entity_id: d.id,
              action: "access_denied",
              description: `Denied AI grounding on ${d.type} — row not visible to user`,
              metadata: { attempted_action: "ai_ground" },
            })),
          );
        } catch { /* best-effort */ }
      }
      if (blocks.length > 0) {
        contextMsgs.push({
          role: "system",
          content: "Reference data (only use these records; do not invent or reference anything else):\n" + blocks.join("\n"),
        });
      } else if (denied.length > 0) {
        contextMsgs.push({
          role: "system",
          content: "No reference records were accessible to this user. Do not fabricate records; ask the user to select records they own.",
        });
      }
    }

    // Build the system instruction by joining all system messages
    const systemContent = [systemMsg, ...packMsgs, ...contextMsgs]
      .map((m) => m.content)
      .join("\n\n");

    // Only user/assistant messages go into the `input` array
    const geminiMessages = data.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        type: "text",
        text: m.content,
      }));

    const MODEL = "gemini-3.6-flash";

    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey as string,
      },
      body: JSON.stringify({
        model: MODEL,
        input: geminiMessages,
        system_instruction: systemContent,
        generation_config: {
          thinking_level: "low",
        }
      }),
    });

    if (res.status === 429) throw new Error("The AI assistant is busy right now. Please try again in a moment.");
    if (res.status === 401 || res.status === 403) {
      await fail(
        `Gemini API key rejected (${res.status}). Check your GEMINI_API_KEY.`,
        "The AI assistant could not answer just now. Please try again in a moment.",
      );
    }
    if (!res.ok) {
      const t = await res.text();
      await fail(
        `AI request failed (${res.status}): ${t.slice(0, 300)}`,
        "The AI assistant could not answer just now. Please try again in a moment.",
      );
    }

    // ✅ NEW RESPONSE FORMAT for Interactions API
    const json = await res.json();
    const modelOutputStep = json.steps?.find(
      (s: { type?: string }) => s?.type === "model_output",
    );
    const content: string =
      modelOutputStep?.content?.[0]?.text ?? "";

    try {
      const promptChars = data.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
      await context.supabase.from("ai_usage_log").insert({
        tenant_id: data.tenantId ?? null,
        user_id: context.userId,
        group_slug: data.pack?.group ?? null,
        pack_slug: data.pack?.slug ?? null,
        model: MODEL,
        prompt_chars: promptChars,
        response_chars: content.length,
      });
    } catch { /* never block an answer on accounting */ }

    return {
      content,
      grounded: contextMsgs.length > 0,
      permitted_count: contextMsgs.length > 0 ? (contextMsgs[0].content.match(/^\[/gm)?.length ?? 0) : 0,
    };
  });