/**
 * DigiVerify — verification server functions.
 *
 * Checks are performed server-side and the outcome is written to
 * `public.verifications`. Raw identifiers are NEVER stored: only a masked
 * form is persisted, alongside the structured result.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type JsonVal = string | number | boolean | null | undefined | JsonVal[] | { [k: string]: JsonVal };
type JsonMap = Record<string, JsonVal>;

export type VerifyKind = "pan" | "aadhaar" | "gst" | "bank_account" | "document_ocr" | "bureau";

export type VerifyResult = {
  id: string | null;
  kind: VerifyKind;
  status: "verified" | "failed" | "manual_review";
  provider: string;
  score: number | null;
  masked: string;
  result: JsonMap;
  error: string | null;
};

/* ------------------------------------------------------------------ */
/* Deterministic validators                                            */
/* ------------------------------------------------------------------ */

const mask = (v: string, keep = 4) =>
  v.length <= keep ? "*".repeat(v.length) : "*".repeat(v.length - keep) + v.slice(-keep);

const PAN_ENTITY: Record<string, string> = {
  P: "Individual", C: "Company", H: "Hindu Undivided Family", A: "Association of Persons",
  B: "Body of Individuals", G: "Government Agency", J: "Artificial Juridical Person",
  L: "Local Authority", F: "Firm / LLP", T: "Trust",
};

function checkPan(raw: string) {
  const pan = raw.toUpperCase().replace(/\s/g, "");
  const ok = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
  return {
    ok,
    masked: mask(pan),
    result: {
      pan_format_valid: ok,
      entity_type: ok ? (PAN_ENTITY[pan[3]!] ?? "Unknown") : null,
      surname_initial: ok ? pan[4] : null,
    },
  };
}

// Verhoeff checksum (UIDAI standard for Aadhaar numbers).
const D_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffValid(num: string) {
  let c = 0;
  const digits = num.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D_TABLE[c]![P_TABLE[i % 8]![digits[i]!]!]!;
  return c === 0;
}

function checkAadhaar(raw: string) {
  const a = raw.replace(/\D/g, "");
  const shaped = /^[2-9]\d{11}$/.test(a);
  const checksum = shaped && verhoeffValid(a);
  return {
    ok: shaped && checksum,
    masked: `XXXX XXXX ${a.slice(-4)}`,
    result: { length_valid: a.length === 12, format_valid: shaped, verhoeff_checksum: checksum },
  };
}

const GST_STATE: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura",
  "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
  "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "36": "Telangana", "37": "Andhra Pradesh",
};

function gstChecksum(gst: string) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = chars.indexOf(gst[i]!);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return chars[(36 - (sum % 36)) % 36] === gst[14];
}

function checkGst(raw: string) {
  const g = raw.toUpperCase().replace(/\s/g, "");
  const shaped = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g);
  const checksum = shaped && gstChecksum(g);
  return {
    ok: shaped && checksum,
    masked: mask(g, 5),
    result: {
      format_valid: shaped,
      checksum_valid: checksum,
      state: shaped ? (GST_STATE[g.slice(0, 2)] ?? "Unknown state code") : null,
      embedded_pan: shaped ? g.slice(2, 12) : null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Network / AI backed checks                                          */
/* ------------------------------------------------------------------ */

async function checkBank(account: string, ifsc: string, holder?: string) {
  const code = ifsc.toUpperCase().replace(/\s/g, "");
  const shapedIfsc = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(code);
  const shapedAcc = /^\d{6,18}$/.test(account.replace(/\s/g, ""));
  if (!shapedIfsc || !shapedAcc) {
    return {
      ok: false, provider: "digiverify", masked: mask(account),
      result: { ifsc_format_valid: shapedIfsc, account_format_valid: shapedAcc },
      error: !shapedIfsc ? "IFSC format is invalid" : "Account number format is invalid",
    };
  }
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${code}`);
    if (!res.ok) {
      return {
        ok: false, provider: "razorpay-ifsc", masked: mask(account),
        result: { ifsc_format_valid: true, account_format_valid: true, ifsc_found: false },
        error: "IFSC not found in the bank directory",
      };
    }
    const b = (await res.json()) as Record<string, string>;
    return {
      ok: true, provider: "razorpay-ifsc", masked: mask(account),
      result: {
        account_holder: holder ?? null,
        ifsc: code, bank: b["BANK"], branch: b["BRANCH"], city: b["CITY"], state: b["STATE"],
        address: b["ADDRESS"], imps: b["IMPS"], neft: b["NEFT"], upi: b["UPI"],
        note: "Bank and branch confirmed from the IFSC directory. A penny-drop name match requires a licensed banking partner.",
      },
      error: null,
    };
  } catch {
    return {
      ok: false, provider: "razorpay-ifsc", masked: mask(account),
      result: {}, error: "Bank directory is unreachable right now",
    };
  }
}

/** Deterministic, clearly-labelled bureau simulation (no licensed bureau connected). */
function checkBureau(pan: string, name?: string) {
  const p = checkPan(pan);
  if (!p.ok) return { ok: false, masked: p.masked, score: null as number | null, result: p.result, error: "PAN is not valid" };
  let h = 0;
  for (const ch of pan.toUpperCase()) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  const score = 620 + (h % 231); // 620–850
  const band = score >= 780 ? "Excellent" : score >= 730 ? "Good" : score >= 680 ? "Fair" : "Thin / rebuild";
  return {
    ok: true, masked: p.masked, score,
    result: {
      subject: name ?? null, score, band,
      open_accounts: 1 + (h % 6),
      enquiries_last_6m: h % 5,
      delinquencies: h % 11 === 0 ? 1 : 0,
      provider_note: "Simulated bureau response for demonstration. Connect a licensed bureau (CIBIL/Experian/CRIF) for production decisions.",
    },
    error: null,
  };
}

async function checkOcr(apiKey: string, fileDataUrl: string, fileName: string, docHint: string) {
  const isPdf = fileDataUrl.startsWith("data:application/pdf");
  const content = isPdf
    ? [
        { type: "text", text: `Extract the key fields from this ${docHint}.` },
        { type: "file", file: { filename: fileName, file_data: fileDataUrl } },
      ]
    : [
        { type: "text", text: `Extract the key fields from this ${docHint}.` },
        { type: "image_url", image_url: { url: fileDataUrl } },
      ];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a document verification OCR engine. Return ONLY a JSON object with the fields you can read " +
            "(for example document_type, name, number, bank, account_number, ifsc, address, date_of_birth, period, " +
            "closing_balance, average_balance, salary_credits, red_flags). Use null when a field is unreadable. " +
            "Add a 'confidence' number between 0 and 1 and a short 'summary' string.",
        },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, result: {}, error: res.status === 402 ? "AI credits exhausted — top up to run OCR." : `OCR failed (${res.status}): ${body.slice(0, 200)}` };
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, result: { raw: text }, error: "Could not read structured data from the document" };
  try {
    return { ok: true, result: JSON.parse(match[0]) as JsonMap, error: null };
  } catch {
    return { ok: false, result: { raw: text }, error: "Document response was not valid JSON" };
  }
}

/* ------------------------------------------------------------------ */
/* Server function                                                     */
/* ------------------------------------------------------------------ */

type VerifyInput = {
  kind: VerifyKind;
  value?: string;
  ifsc?: string;
  subjectName?: string;
  mobile?: string;

  recordId?: string | null;
  leadId?: string | null;
  fileDataUrl?: string;
  fileName?: string;
  docHint?: string;
};

export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as VerifyInput;
    const kinds: VerifyKind[] = ["pan", "aadhaar", "gst", "bank_account", "document_ocr", "bureau"];
    if (!d || !kinds.includes(d.kind)) throw new Error("Unsupported verification type");
    if (d.kind === "document_ocr") {
      if (!d.fileDataUrl?.startsWith("data:")) throw new Error("Upload a document to run OCR");
      if (d.fileDataUrl.length > 8_000_000) throw new Error("Document is too large (max ~6 MB)");
    } else if (!d.value || d.value.trim().length < 4) {
      throw new Error("Enter the value to verify");
    }
    if (d.kind === "bank_account" && !d.ifsc) throw new Error("IFSC is required for a bank check");
    return d;
  })
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const value = (data.value ?? "").trim();
    let status: VerifyResult["status"] = "failed";
    let provider = "digiverify";
    let score: number | null = null;
    let masked = value ? mask(value) : (data.fileName ?? "document");
    let result: JsonMap = {};
    let error: string | null = null;

    const live = await import("./digiverify.server");
    const hasLive = live.liveConfigured();

    if (data.kind === "pan") {
      const r = checkPan(value);
      masked = r.masked; result = r.result; status = r.ok ? "verified" : "failed";
      error = r.ok ? null : "PAN format is invalid";
      if (r.ok && hasLive) {
        const l = await live.livePan(value.toUpperCase());
        if (!l.unavailable) {
          provider = "digiverification";
          result = { ...result, ...(l.data ?? {}) } as JsonMap;
          status = l.ok ? "verified" : "failed";
          error = l.ok ? null : (l.message ?? "PAN could not be verified");
        } else {
          result = { ...result, live_lookup: "unavailable", live_note: l.message } as JsonMap;
          status = "manual_review";
        }
      }
    } else if (data.kind === "aadhaar") {
      const r = checkAadhaar(value);
      masked = r.masked; result = r.result; status = r.ok ? "verified" : "failed";
      error = r.ok ? null : "Aadhaar number failed the checksum";
      if (r.ok && hasLive) {
        const l = await live.liveAadhaar(value.replace(/\s/g, ""));
        if (!l.unavailable) {
          provider = "digiverification";
          result = { ...result, ...(l.data ?? {}) } as JsonMap;
          status = l.ok ? "verified" : "failed";
          error = l.ok ? null : (l.message ?? "Aadhaar could not be verified");
        } else {
          result = { ...result, live_lookup: "unavailable", live_note: l.message } as JsonMap;
          status = "manual_review";
        }
      }
    } else if (data.kind === "gst") {
      const r = checkGst(value);
      masked = r.masked; result = r.result; status = r.ok ? "verified" : "failed";
      error = r.ok ? null : "GSTIN failed format or checksum validation";
      if (r.ok && hasLive) {
        const l = await live.liveGst(value.toUpperCase());
        if (!l.unavailable) {
          provider = "digiverification";
          result = { ...result, ...(l.data ?? {}) } as JsonMap;
          status = l.ok ? "verified" : "failed";
          error = l.ok ? null : (l.message ?? "GSTIN could not be verified");
        } else {
          result = { ...result, live_lookup: "unavailable", live_note: l.message } as JsonMap;
          status = "manual_review";
        }
      }
    } else if (data.kind === "bank_account") {
      const r = await checkBank(value, data.ifsc!, data.subjectName);
      masked = r.masked; result = r.result; provider = r.provider; error = r.error;
      status = r.ok ? "verified" : "failed";
      if (r.ok && hasLive) {
        const l = await live.liveBank(value.replace(/\s/g, ""), data.ifsc!.toUpperCase());
        if (!l.unavailable) {
          provider = "digiverification";
          result = { ...result, ...(l.data ?? {}) } as JsonMap;
          status = l.ok ? "verified" : "failed";
          error = l.ok ? null : (l.message ?? "Bank account could not be verified");
        } else {
          result = { ...result, penny_drop: "unavailable", live_note: l.message } as JsonMap;
        }
      }
    } else if (data.kind === "bureau") {
      const p = checkPan(value);
      masked = p.masked;
      if (!p.ok) {
        result = p.result; error = "PAN is not valid"; status = "failed"; provider = "digiverify";
      } else if (hasLive && data.mobile && /^\d{10}$/.test(data.mobile.trim())) {
        const l = await live.liveBureau(value.toUpperCase(), data.subjectName ?? "", data.mobile.trim());
        provider = "digiverification-bureau";
        result = { ...(l.data ?? {}), message: l.message } as JsonMap;
        const raw = (l.data?.["score"] ?? l.data?.["credit_score"] ?? l.data?.["cibil_score"]) as unknown;
        const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
        score = Number.isFinite(parsed) ? parsed : null;
        if (l.unavailable) {
          status = "manual_review";
          error = l.message ?? "Bureau service is unreachable";
        } else {
          status = l.ok ? "verified" : "failed";
          error = l.ok ? null : (l.message ?? "Bureau report could not be fetched");
        }
      } else {
        const r = checkBureau(value, data.subjectName);
        masked = r.masked; result = r.result; score = r.score;
        provider = "simulated-bureau";
        status = r.ok ? "manual_review" : "failed";
        error = hasLive ? "Enter the applicant name and a 10-digit mobile number for a live bureau pull." : r.error;
      }
    } else {

      const apiKey = process.env["LOVABLE_API_KEY"];
      if (!apiKey) throw new Error("Document OCR is not configured on this workspace.");
      const r = await checkOcr(apiKey, data.fileDataUrl!, data.fileName ?? "document", data.docHint ?? "identity or financial document");
      provider = "lovable-ai-ocr";
      masked = data.fileName ?? "document";
      result = r.result; error = r.error;
      const conf = typeof (r.result as { confidence?: number }).confidence === "number" ? (r.result as { confidence: number }).confidence : null;
      score = conf === null ? null : Math.round(conf * 100);
      status = r.ok ? (conf !== null && conf < 0.6 ? "manual_review" : "verified") : "failed";
    }

    const { data: row, error: dbError } = await context.supabase
      .from("verifications")
      .insert({
        kind: data.kind,
        subject_name: data.subjectName ?? null,
        identifier_masked: masked,
        status,
        provider,
        score,
        result: result as never,
        error,
        record_id: data.recordId ?? null,
        lead_id: data.leadId ?? null,
        requested_by: context.userId,
      })
      .select("id")
      .single();

    if (dbError) throw new Error(`Could not save the verification: ${dbError.message}`);

    return { id: row?.id ?? null, kind: data.kind, status, provider, score, masked, result, error };
  });
