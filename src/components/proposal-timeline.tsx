import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { approvalLabel, type ApprovalStatus } from "@/lib/proposal-deal";
import { CheckCircle2, Clock, FileText, Send, ShieldCheck, XCircle, ArrowRightLeft } from "lucide-react";

export interface ProposalEvent {
  id: string;
  proposal_id: string;
  event_type: string;
  description: string | null;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

const iconFor = (type: string) => {
  if (type === "created") return FileText;
  if (type === "stage_sent") return Send;
  if (type.startsWith("approval_approved")) return ShieldCheck;
  if (type.startsWith("approval_rejected")) return XCircle;
  if (type.startsWith("approval_")) return Clock;
  if (type === "converted" || type === "deal_updated") return ArrowRightLeft;
  if (type === "stage_accepted") return CheckCircle2;
  if (type === "stage_rejected") return XCircle;
  return Clock;
};

const toneFor = (type: string) => {
  if (type.includes("rejected")) return "text-destructive";
  if (type.includes("approved") || type === "stage_accepted") return "text-success";
  if (type === "converted" || type === "deal_updated") return "text-primary";
  return "text-muted-foreground";
};

export function ApprovalBadge({ status }: { status: ApprovalStatus | null | undefined }) {
  const s = (status ?? "not_requested") as ApprovalStatus;
  const tone =
    s === "approved" ? "bg-success/15 text-success"
      : s === "pending" ? "bg-warning/15 text-warning"
        : s === "rejected" ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${tone}`}>{approvalLabel[s]}</span>;
}

export function ProposalTimeline({ proposalIds }: { proposalIds: string[] }) {
  const ids = proposalIds.filter(Boolean);
  const { data, isLoading } = useQuery({
    queryKey: ["proposal-events", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const res = await apiFetch<ProposalEvent[]>(
        `/api/v1/proposal-events?proposal_ids=${encodeURIComponent(ids.join(","))}&limit=50`
      );
      return Array.isArray(res) ? res : [];
    },
  });

  if (ids.length === 0) return <p className="text-xs text-muted-foreground">No proposal linked yet.</p>;
  if (isLoading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>;
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">No proposal activity yet.</p>;

  return (
    <ol className="space-y-2.5">
      {data.map((e) => {
        const Icon = iconFor(e.event_type);
        return (
          <li key={e.id} className="flex gap-2.5 text-xs">
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${toneFor(e.event_type)}`} />
            <div className="min-w-0">
              <p className="font-medium">{e.description || e.event_type.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ApprovalHistory({ proposalId }: { proposalId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["proposal-approval-history", proposalId],
    enabled: !!proposalId,
    queryFn: async () => {
      const res = await apiFetch<ProposalEvent[]>(
        `/api/v1/proposal-events?proposal_ids=${proposalId}&event_type_prefix=approval_&limit=50`
      );
      return Array.isArray(res) ? res : [];
    },
  });

  if (isLoading) return <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>;
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">No approval activity yet.</p>;

  return (
    <ol className="space-y-2.5">
      {data.map((e) => {
        const Icon = iconFor(e.event_type);
        const notes = (e.metadata as { notes?: string } | null)?.notes;
        return (
          <li key={e.id} className="flex gap-2.5 text-xs">
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${toneFor(e.event_type)}`} />
            <div className="min-w-0">
              <p className="font-medium">{e.description || e.event_type.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">
                {e.actor_name ?? "System"} · {new Date(e.created_at).toLocaleString()}
              </p>
              {notes && <p className="text-muted-foreground italic">"{notes}"</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}