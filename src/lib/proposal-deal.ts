import { apiFetch } from "@/lib/api";

/** Proposal statuses used across the Proposals module. */
export const PROPOSAL_STAGES = ["draft", "sent", "negotiation", "accepted", "declined"] as const;
export type ProposalStage = (typeof PROPOSAL_STAGES)[number];

/** Pipeline status values on a Lead. */
export type LeadStatus =
  | "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";

/** Suggested lead pipeline status for a given proposal stage. */
export const proposalStageToDealStage: Record<ProposalStage, LeadStatus> = {
  draft: "qualified",
  sent: "proposal_sent",
  negotiation: "negotiation",
  accepted: "won",
  declined: "lost",
};

export const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const approvalLabel: Record<ApprovalStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Approval rejected",
};

export interface ConvertibleProposal {
  id: number;
  title: string;
  description: string | null;
  lead_id: number | null;
  lead_name: string | null;
  status: string;
  approval_status?: ApprovalStatus | null;
  pipeline_stage?: string | null;
  amount: string | number;
  currency: string;
  valid_until: string | null;
  terms: string | null;
  probability: number;
  close_date: string | null;
  owner: string | null;
  version: string | null;
  template_id: number | null;
}

export interface ConvertibleLead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  message: string | null;
  status: string | null;
  priority: string | null;
  value: string | null;
  assigned_to: number | null;
  score: number | null;
  custom_fields?: Record<string, unknown> | null;
}

export interface ConvertOptions {
  /** Pipeline stage to set on the linked lead. */
  dealStage: LeadStatus;
  /** Deal value to set on the linked lead. */
  value: number;
}

/** A proposal must be approved before it can push changes to its linked lead. */
export function canConvert(p: { approval_status?: ApprovalStatus | null }) {
  return p.approval_status === "approved";
}

/**
 * Pushes a proposal's outcome into its linked lead: updates the lead's pipeline
 * status and value, then marks the proposal itself as converted.
 *
 * Unlike the old Supabase version, a proposal here can only ever be linked to an
 * *existing* lead — there's no company/contact data on a proposal to create a new
 * lead from — so this never creates a lead, it only updates the one already linked.
 */
export async function convertProposalToDeal(
  proposal: ConvertibleProposal,
  lead: ConvertibleLead,
  opts: ConvertOptions,
) {
  if (!proposal.lead_id) {
    throw new Error("This proposal isn't linked to a lead yet — link one before converting.");
  }
  if (!canConvert(proposal)) {
    throw new Error("This proposal needs manager approval before it can move to the pipeline.");
  }

  // Leads are updated via a full PUT — replay every field, overriding status/value.
  await apiFetch(`/api/v1/leads/${lead.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      message: lead.message,
      status: opts.dealStage,
      priority: lead.priority,
      value: opts.value,
      assigned_to: lead.assigned_to,
      score: lead.score,
      custom_fields: lead.custom_fields ?? {},
    }),
  });

  // Same story for proposals — PUT needs the full object back, so replay it with
  // pipeline_stage updated. "in_pipeline" matches the value the GET /api/v1/proposals
  // list endpoint actually returns (confirmed from the live schema) — the earlier
  // "converted" placeholder wouldn't have matched anything the UI checks for.
  await apiFetch(`/api/v1/proposals/${proposal.id}`, {
    method: "PUT",
    body: JSON.stringify({
      lead_id: proposal.lead_id,
      title: proposal.title,
      description: proposal.description,
      amount: Number(proposal.amount),
      currency: proposal.currency,
      valid_until: proposal.valid_until,
      terms: proposal.terms,
      status: proposal.status,
      probability: proposal.probability,
      close_date: proposal.close_date,
      owner: proposal.owner,
      version: proposal.version,
      approval_status: proposal.approval_status,
      pipeline_stage: "in_pipeline",
      lead_name: proposal.lead_name,
      template_id: proposal.template_id,
    }),
  });

  return { leadId: lead.id };
}