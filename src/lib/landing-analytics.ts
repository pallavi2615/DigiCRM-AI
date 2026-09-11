import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "dc_lp_session";
const ENGAGED_MS = 15000;

function ensureSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `${Date.now()}`;
  }
}

function readSource() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    referrer: document.referrer || null,
    source: params.get("utm_source") || (document.referrer ? new URL(document.referrer).hostname : "direct"),
  };
}

export async function trackLandingEvent(opts: {
  tenantId: string;
  pageSlug?: string;
  eventType: "view" | "submit" | "bounce" | "engaged";
  durationMs?: number;
}) {
  const src = readSource();
  try {
    await supabase.from("landing_page_events").insert({
      tenant_id: opts.tenantId,
      page_slug: opts.pageSlug ?? "home",
      event_type: opts.eventType,
      session_id: ensureSessionId(),
      user_agent: navigator.userAgent.slice(0, 500),
      duration_ms: opts.durationMs ?? null,
      ...src,
    });
  } catch {
    /* silent — analytics never break the page */
  }
}

export function installBounceTracking(tenantId: string, pageSlug = "home") {
  const start = Date.now();
  let engaged = false;
  let submitted = false;
  const markSubmitted = () => { submitted = true; };
  window.addEventListener("dc:lp:submitted", markSubmitted);

  const engagedTimer = window.setTimeout(() => {
    engaged = true;
    void trackLandingEvent({ tenantId, pageSlug, eventType: "engaged", durationMs: ENGAGED_MS });
  }, ENGAGED_MS);

  const onUnload = () => {
    const duration = Date.now() - start;
    if (!submitted && !engaged) {
      // fire-and-forget bounce
      try {
        const payload = JSON.stringify({
          tenant_id: tenantId, page_slug: pageSlug, event_type: "bounce",
          duration_ms: duration, session_id: sessionStorage.getItem(SESSION_KEY),
          ...readSource(),
        });
        const blob = new Blob([payload], { type: "application/json" });
        // beacon to a public endpoint would be ideal; use supabase insert best-effort
        void supabase.from("landing_page_events").insert(JSON.parse(payload));
        void blob;
      } catch {/* noop */}
    }
  };
  window.addEventListener("pagehide", onUnload);

  return () => {
    window.clearTimeout(engagedTimer);
    window.removeEventListener("dc:lp:submitted", markSubmitted);
    window.removeEventListener("pagehide", onUnload);
  };
}
