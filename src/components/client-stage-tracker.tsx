import { CheckCircle2, Circle, FileUp, Loader2, ShieldCheck, Banknote, XCircle } from "lucide-react";

export type JourneyStep = "application" | "documents" | "review" | "approved" | "disbursed";

const STEPS: { key: JourneyStep; label: string; hint: string; icon: typeof Circle }[] = [
  { key: "application", label: "Application received", hint: "We have your enquiry and opened a file.", icon: Circle },
  { key: "documents", label: "Documents submitted", hint: "Your paperwork is with us.", icon: FileUp },
  { key: "review", label: "Under review", hint: "Our team is checking the details.", icon: Loader2 },
  { key: "approved", label: "Approved", hint: "Cleared and ready to complete.", icon: ShieldCheck },
  { key: "disbursed", label: "Completed", hint: "Funds released or handover done.", icon: Banknote },
];

/** Words packs use for each canonical client-facing step. */
const HINTS: Record<JourneyStep, string[]> = {
  application: ["lead", "new", "enquiry", "application", "prospect", "site visit", "consulted", "requested"],
  documents: ["doc", "kyc", "paperwork", "collected", "submitted", "quotation", "shortlist"],
  review: ["review", "login", "underwrit", "credit", "assess", "verification", "processing", "negotiation", "admitted", "in progress"],
  approved: ["approved", "sanction", "accepted", "won", "agreement", "booked", "confirmed", "offer"],
  disbursed: ["disbursed", "paid", "closed", "handover", "delivered", "completed", "registered", "live"],
};

export function stageToStep(stage: string, packStages: string[], won: boolean | null): JourneyStep {
  const s = (stage ?? "").toLowerCase();
  const match = (Object.keys(HINTS) as JourneyStep[])
    .slice()
    .reverse()
    .find((k) => HINTS[k].some((w) => s.includes(w)));
  if (match) return match;
  if (won) return "disbursed";
  // Fall back to relative position inside the pack's own stage list.
  const idx = packStages.findIndex((p) => p.toLowerCase() === s);
  if (idx < 0 || packStages.length < 2) return "application";
  const ratio = idx / (packStages.length - 1);
  if (ratio >= 1) return "disbursed";
  if (ratio >= 0.75) return "approved";
  if (ratio >= 0.4) return "review";
  if (ratio > 0) return "documents";
  return "application";
}

export function ClientStageTracker({
  stage,
  packStages,
  won,
  docCount = 0,
  lostLabel,
}: {
  stage: string;
  packStages: string[];
  won: boolean | null;
  docCount?: number;
  lostLabel?: string | null;
}) {
  let step = stageToStep(stage, packStages, won);
  if (step === "application" && docCount > 0) step = "documents";
  const activeIndex = STEPS.findIndex((s) => s.key === step);
  const lost = won === false && (stage ?? "").toLowerCase().match(/lost|rejected|declined|cancel/);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Your application</div>
        <div className="text-xs text-muted-foreground">{stage}</div>
      </div>
      <ol className="space-y-2.5">
        {STEPS.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex && !lost;
          const Icon = lost && i === activeIndex ? XCircle : done ? CheckCircle2 : s.icon;
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    lost && i === activeIndex
                      ? "text-destructive"
                      : done
                        ? "text-green-600"
                        : active
                          ? "text-primary"
                          : "text-muted-foreground/40"
                  } ${active && s.key === "review" ? "animate-spin" : ""}`}
                />
                {i < STEPS.length - 1 && (
                  <span className={`mt-1 w-px flex-1 ${done ? "bg-green-600/50" : "bg-border"}`} style={{ minHeight: 14 }} />
                )}
              </div>
              <div className="pb-0.5">
                <div className={`text-sm ${active ? "font-medium" : done ? "" : "text-muted-foreground"}`}>{s.label}</div>
                {(active || done) && <div className="text-xs text-muted-foreground">{s.hint}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      {lost && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {lostLabel ?? "This application did not go through. Talk to your relationship manager for the next steps."}
        </div>
      )}
    </div>
  );
}
