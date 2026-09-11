/**
 * Affiliate referral attribution.
 *
 * A partner shares `https://…/?ref=AF12CD`. We store the code in the browser
 * for the configured cookie window and attach it to every public form
 * submission so the partner gets credited for the lead.
 */

const KEY = "digicrm_ref";
const DEFAULT_DAYS = 60;

type Stored = { code: string; at: number };

export function captureReferral(days = DEFAULT_DAYS) {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref");
  if (!code) return;
  const clean = code.trim().slice(0, 32).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(clean)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() } satisfies Stored));
    window.localStorage.setItem(`${KEY}_days`, String(days));
  } catch {
    /* storage unavailable — attribution is best effort */
  }
}

export function getReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    const days = Number(window.localStorage.getItem(`${KEY}_days`) ?? DEFAULT_DAYS);
    if (!parsed?.code || Date.now() - parsed.at > days * 86_400_000) return null;
    return parsed.code;
  } catch {
    return null;
  }
}
