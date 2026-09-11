import { supabase } from "@/integrations/supabase/client";

/** Proposal stages used across the Proposals module. */
export const PROPOSAL_STAGES = ["draft", "sent", "negotiation", "accepted", "rejected"] as const;
export type ProposalStage = (typeof PROPOSAL_STAGES)[number];

export type LeadStatus =
  | "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";

/** Which pipeline stage a proposal lands in when converted. */
export const proposalStageToDealStage: Record<ProposalStage, LeadStatus> = {
  draft: "qualified",
  sent: "proposal_sent",
  negotiation: "negotiation",
  accepted: "won",
  rejected: "lost",
};

export const APPROVAL_STATUSES = ["not_requested", "pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const approvalLabel: Record<ApprovalStatus, string> = {
  not_requested: "Approval not requested",
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Approval rejected",
};

export interface ConvertibleProposal {
  id: string;
  title: string;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  stage: ProposalStage;
  value: number;
  close_date: string | null;
  owner_id: string | null;
  notes: string | null;
  approval_status?: ApprovalStatus | null;
}


export interface ConvertOptions {
  /** Pipeline stage for the resulting deal. */
  dealStage: LeadStatus;
  /** Deal value in ₹. */
  value: number;
  /** Owner (assigned_to) of the resulting deal. */
  ownerId: string;
  /** Current signed-in user id — required by the leads insert policy. */
  userId: string;
}

/** A proposal must be approved before it can become (or update) a pipeline deal. */
export function canConvert(p: { approval_status?: ApprovalStatus | null }) {
  return (p.approval_status ?? "not_requested") === "approved";
}

/**
 * Turns a proposal into a Pipeline deal (a row in `leads`).
 * Re-uses the linked lead when the proposal already has one, otherwise creates
 * a new lead from the linked company/contact and links it back to the proposal.
 * Requires the proposal to be approved.
 */
export async function convertProposalToDeal(p: ConvertibleProposal, opts: ConvertOptions) {
  if (!canConvert(p)) {
    throw new Error("This proposal needs manager approval before it can move to the pipeline.");
  }
  if (p.lead_id) {
    const { error } = await supabase
      .from("leads")
      .update({
        status: opts.dealStage,
        estimated_value: opts.value,
        assigned_to: opts.ownerId || null,
        expected_close_date: p.close_date,
      })
      .eq("id", p.lead_id);
    if (error) throw error;
    await supabase.from("proposal_events").insert({
      proposal_id: p.id,
      lead_id: p.lead_id,
      event_type: "deal_updated",
      description: `Linked deal updated — stage ${opts.dealStage.replace("_", " ")}, value ₹${opts.value.toLocaleString()}`,
      actor_id: opts.userId,
    });
    return { leadId: p.lead_id, created: false };
  }


  let companyName = p.title;
  let contactPerson: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;

  if (p.company_id) {
    const { data } = await supabase.from("companies").select("name, industry, email, phone").eq("id", p.company_id).maybeSingle();
    if (data?.name) companyName = data.name;
    email = data?.email ?? null;
    phone = data?.phone ?? null;
  }
  if (p.contact_id) {
    const { data } = await supabase
      .from("contacts").select("first_name, last_name, email, phone").eq("id", p.contact_id).maybeSingle();
    if (data) {
      contactPerson = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
      email = email ?? data.email ?? null;
      phone = phone ?? data.phone ?? null;
    }
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      company_name: companyName,
      contact_person: contactPerson,
      email,
      phone,
      company_id: p.company_id,
      contact_id: p.contact_id,
      status: opts.dealStage,
      estimated_value: opts.value,
      expected_close_date: p.close_date,
      assigned_to: opts.ownerId || opts.userId,
      created_by: opts.userId,
      source: "proposal",
      notes: p.notes,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: linkError } = await supabase.from("proposals").update({ lead_id: lead.id }).eq("id", p.id);
  if (linkError) throw linkError;

  return { leadId: lead.id as string, created: true };
}
