/**
 * DigiVerification live API client (server only).
 *
 * Auth: every request carries a short-lived HS256 JWT in the `jwt-token`
 * header, signed with the partner secret over { partnerId, timestamp }.
 * Credentials are read from the environment inside each call — never at
 * module scope and never sent to the browser.
 */

type Json = Record<string, unknown>;

export type LiveCall = {
  ok: boolean;
  /** HTTP/API level failure (network, auth, credits) — caller may fall back. */
  unavailable: boolean;
  status: number;
  message: string | null;
  data: Json | null;
  raw: Json | null;
};

function b64url(bytes: Uint8Array | string) {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(partnerId: string, secret: string) {
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "HS256" }));
  const payload = b64url(JSON.stringify({ partnerId, timestamp: Math.floor(Date.now() / 1000) }));
  const body = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

export function liveConfigured() {
  return Boolean(process.env["DIGIVERIFY_PARTNER_ID"] && process.env["DIGIVERIFY_SECRET"]);
}

async function call(path: string, payload: Json): Promise<LiveCall> {
  const partnerId = process.env["DIGIVERIFY_PARTNER_ID"];
  const secret = process.env["DIGIVERIFY_SECRET"];
  const base = (process.env["DIGIVERIFY_BASE_URL"] ?? "https://api.digiverification.com").replace(/\/$/, "");
  if (!partnerId || !secret) {
    return { ok: false, unavailable: true, status: 0, message: "Live verification is not configured", data: null, raw: null };
  }

  try {
    const token = await signJwt(partnerId, secret);
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "jwt-token": token,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json: Json | null = null;
    try {
      json = JSON.parse(text) as Json;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg = (json?.["message"] as string | undefined) ?? text.slice(0, 200);
      // 4xx that the provider answered (invalid id) is a real result, not an outage.
      const unavailable = res.status === 401 || res.status === 403 || res.status >= 500 || json === null;
      return { ok: false, unavailable, status: res.status, message: msg || `Request failed (${res.status})`, data: (json?.["data"] as Json) ?? null, raw: json };
    }

    const ok = json?.["status"] === true || json?.["status"] === "success";
    const msg = (json?.["message"] as string | undefined) ?? null;
    // Provider answers 200 with status:false when its own upstream is down.
    const upstreamDown =
      !ok && /provider down|provide down|error while hitting|internal server error|timeout/i.test(`${msg ?? ""} ${String(json?.["error"] ?? "")}`);
    return {
      ok,
      unavailable: upstreamDown,
      status: res.status,
      message: msg,
      data: (json?.["data"] as Json) ?? null,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      unavailable: true,
      status: 0,
      message: e instanceof Error ? e.message : "Verification service is unreachable",
      data: null,
      raw: null,
    };
  }
}

export const livePan = (pan: string) => call("/api/v4/pan/report", { id_number: pan });

export const liveAadhaar = (aadhaar: string) => call("/api/v4/aadhaar-validation", { id_number: aadhaar });

export const liveGst = (gstin: string) => call("/api/v4/corporate-gstin/advanced-verify", { id_number: gstin });

export const liveBank = (accountNumber: string, ifsc: string) =>
  call("/api/v2/account-verification/verify", {
    account_number: accountNumber,
    ifsc_code: ifsc,
    clientRefNum: `digicrm-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
  });

export function liveBureau(pan: string, fullName: string, mobile: string) {
  const parts = fullName.trim().split(/\s+/);
  return call("/api/v1/credit-bureau/get-score-only", {
    first_name: parts[0] ?? fullName,
    last_name: parts.length > 1 ? parts[parts.length - 1]! : (parts[0] ?? fullName),
    mobile,
    pan,
  });
}
