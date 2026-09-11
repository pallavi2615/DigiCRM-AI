import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Sheets is not connected yet. Ask an admin to connect the Google Sheets integration in Lovable, then retry.",
    );
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "content-type": "application/json",
  };
}

async function gateway(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY}${path}`, { ...init, headers: gatewayHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Sheets error [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : {};
}

/** Column letter (A, B, ... AA) → 0-based index */
function colIndex(letter: string): number {
  const s = letter.trim().toUpperCase();
  let n = 0;
  for (const ch of s) {
    const code = ch.charCodeAt(0) - 64;
    if (code < 1 || code > 26) return -1;
    n = n * 26 + code;
  }
  return n - 1;
}

export const syncSheetNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { configId: string }) => {
    if (!input?.configId) throw new Error("configId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: config, error: cfgErr } = await supabase
      .from("sheet_sync_configs")
      .select("id, tenant_id, name, spreadsheet_id, range_a1, column_mapping, group_slug, pack_slug")
      .eq("id", data.configId)
      .maybeSingle();
    if (cfgErr) throw new Error(cfgErr.message);
    if (!config) throw new Error("Sheet configuration not found or not accessible");

    const values: string[][] =
      (await gateway(`/spreadsheets/${config.spreadsheet_id}/values/${config.range_a1}`)).values ?? [];

    const mapping = (config.column_mapping ?? {}) as Record<string, string>;
    const rows: Record<string, unknown>[] = [];
    for (const row of values) {
      const rec: Record<string, unknown> = {};
      for (const [field, letter] of Object.entries(mapping)) {
        const i = colIndex(String(letter));
        const v = i >= 0 ? (row[i] ?? "").trim() : "";
        if (v) rec[field] = v;
      }
      if (!rec["email"] && !rec["phone"] && !rec["contact_person"]) continue;
      rows.push({
        tenant_id: config.tenant_id,
        company_name: (rec["company_name"] as string) ?? (rec["contact_person"] as string) ?? "Sheet import",
        contact_person: (rec["contact_person"] as string) ?? null,
        email: (rec["email"] as string) ?? null,
        phone: (rec["phone"] as string) ?? null,
        notes: (rec["notes"] as string) ?? null,
        source: "Google Sheets",
        status: "new",
      });
    }

    let inserted = 0;
    let failure: string | null = null;
    const insertedIds: { id: string; row: Record<string, unknown> }[] = [];
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { data: created, error } = await supabase.from("leads").insert(chunk as never).select("id");
      if (error) { failure = error.message; break; }
      inserted += chunk.length;
      (created ?? []).forEach((r: { id: string }, idx: number) => insertedIds.push({ id: r.id, row: chunk[idx] ?? {} }));
    }

    // Attribute every imported row to the Google Sheets channel and open a
    // matching record in the pack pipeline so the funnel reflects it.
    if (insertedIds.length > 0 && config.tenant_id) {
      const { trackInboundLead } = await import("@/lib/lead-tracking.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const item of insertedIds) {
        try {
          await trackInboundLead(
            supabaseAdmin as never,
            {
              slug: "google-sheets",
              name: "Google Sheets",
              kind: "google_sheets",
              groupSlug: config.group_slug ?? null,
              packSlug: config.pack_slug ?? null,
            },
            config.name ?? "Google Sheets import",
            {
              tenantId: config.tenant_id,
              leadId: item.id,
              title: String(item.row["company_name"] ?? "Sheet import"),
              contactName: (item.row["contact_person"] as string) ?? null,
              contactEmail: (item.row["email"] as string) ?? null,
              contactPhone: (item.row["phone"] as string) ?? null,
            },
          );
        } catch { /* attribution is best-effort */ }
      }
    }


    await supabase
      .from("sheet_sync_configs")
      .update({
        last_run_at: new Date().toISOString(),
        last_row_count: inserted,
        last_status: failure ? `error: ${failure}` : `imported ${inserted} rows`,
      })
      .eq("id", config.id);

    if (failure) throw new Error(failure);
    return { inserted, scanned: values.length };
  });

type ExportInput = { entity: "leads" | "contacts" | "companies"; spreadsheetId?: string; title?: string };

const COLUMNS: Record<ExportInput["entity"], string[]> = {
  leads: ["company_name", "contact_person", "email", "phone", "status", "priority", "source", "estimated_value", "expected_close_date", "created_at"],
  contacts: ["first_name", "last_name", "email", "phone", "designation", "created_at"],
  companies: ["name", "industry", "website", "email", "phone", "city", "country", "annual_revenue", "created_at"],
};

export const exportToSheetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExportInput) => {
    if (!input?.entity || !COLUMNS[input.entity]) throw new Error("Unsupported entity");
    return input;
  })
  .handler(async ({ data, context }) => {
    const cols = COLUMNS[data.entity];
    const { data: rows, error } = await context.supabase
      .from(data.entity)
      .select(cols.join(", "))
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const table = [cols, ...(rows ?? []).map((r) => cols.map((c) => String((r as never as Record<string, unknown>)[c] ?? "")))];

    let spreadsheetId = data.spreadsheetId?.trim();
    if (!spreadsheetId) {
      const created = await gateway("/spreadsheets", {
        method: "POST",
        body: JSON.stringify({
          properties: { title: data.title || `DigiCRM ${data.entity} export ${new Date().toISOString().slice(0, 10)}` },
        }),
      });
      spreadsheetId = created.spreadsheetId as string;
    }

    const lastCol = String.fromCharCode(64 + Math.min(cols.length, 26));
    await gateway(
      `/spreadsheets/${spreadsheetId}/values/A1:${lastCol}${table.length}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: table }) },
    );

    return {
      spreadsheetId,
      rows: table.length - 1,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  });
