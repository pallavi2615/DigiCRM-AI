-- 1. Approval + lifecycle columns on proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_approval_status_check;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_approval_status_check
  CHECK (approval_status IN ('not_requested','pending','approved','rejected'));

-- 2. Visibility helper mirroring the proposals SELECT policy
CREATE OR REPLACE FUNCTION private.can_view_proposal(_proposal uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = _proposal
      AND (
        private.has_role(_user, 'super_admin'::app_role)
        OR private.has_role(_user, 'admin'::app_role)
        OR private.has_role(_user, 'sales_manager'::app_role)
        OR p.owner_id = _user
        OR p.created_by = _user
      )
  );
$$;
REVOKE ALL ON FUNCTION private.can_view_proposal(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_view_proposal(uuid, uuid) TO authenticated, service_role;

-- 3. Templates
CREATE TABLE IF NOT EXISTS public.proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  body TEXT NOT NULL DEFAULT '',
  default_value NUMERIC,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_templates TO authenticated;
GRANT ALL ON public.proposal_templates TO service_role;
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read shared or own templates" ON public.proposal_templates;
CREATE POLICY "Staff can read shared or own templates" ON public.proposal_templates
  FOR SELECT TO authenticated
  USING (is_shared OR created_by = auth.uid()
    OR private.has_role(auth.uid(),'super_admin'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'sales_manager'::app_role));

DROP POLICY IF EXISTS "Staff can create their own templates" ON public.proposal_templates;
CREATE POLICY "Staff can create their own templates" ON public.proposal_templates
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners and managers can update templates" ON public.proposal_templates;
CREATE POLICY "Owners and managers can update templates" ON public.proposal_templates
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid()
    OR private.has_role(auth.uid(),'super_admin'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'sales_manager'::app_role))
  WITH CHECK (created_by = auth.uid()
    OR private.has_role(auth.uid(),'super_admin'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'sales_manager'::app_role));

DROP POLICY IF EXISTS "Owners and managers can delete templates" ON public.proposal_templates;
CREATE POLICY "Owners and managers can delete templates" ON public.proposal_templates
  FOR DELETE TO authenticated
  USING (created_by = auth.uid()
    OR private.has_role(auth.uid(),'super_admin'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'sales_manager'::app_role));

DROP TRIGGER IF EXISTS proposal_templates_updated_at ON public.proposal_templates;
CREATE TRIGGER proposal_templates_updated_at BEFORE UPDATE ON public.proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Version history
CREATE TABLE IF NOT EXISTS public.proposal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT,
  value NUMERIC,
  ai_content TEXT,
  notes TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposal_versions_proposal_idx ON public.proposal_versions(proposal_id, version DESC);
GRANT SELECT, INSERT ON public.proposal_versions TO authenticated;
GRANT ALL ON public.proposal_versions TO service_role;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read versions of visible proposals" ON public.proposal_versions;
CREATE POLICY "Read versions of visible proposals" ON public.proposal_versions
  FOR SELECT TO authenticated USING (private.can_view_proposal(proposal_id, auth.uid()));

DROP POLICY IF EXISTS "Insert versions for visible proposals" ON public.proposal_versions;
CREATE POLICY "Insert versions for visible proposals" ON public.proposal_versions
  FOR INSERT TO authenticated WITH CHECK (private.can_view_proposal(proposal_id, auth.uid()));

-- 5. Timeline events
CREATE TABLE IF NOT EXISTS public.proposal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  actor_id UUID REFERENCES auth.users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposal_events_proposal_idx ON public.proposal_events(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS proposal_events_lead_idx ON public.proposal_events(lead_id, created_at DESC);
GRANT SELECT, INSERT ON public.proposal_events TO authenticated;
GRANT ALL ON public.proposal_events TO service_role;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read events of visible proposals" ON public.proposal_events;
CREATE POLICY "Read events of visible proposals" ON public.proposal_events
  FOR SELECT TO authenticated USING (private.can_view_proposal(proposal_id, auth.uid()));

DROP POLICY IF EXISTS "Insert events for visible proposals" ON public.proposal_events;
CREATE POLICY "Insert events for visible proposals" ON public.proposal_events
  FOR INSERT TO authenticated WITH CHECK (private.can_view_proposal(proposal_id, auth.uid()));

-- 6. Only managers and above may change approval outcome
CREATE OR REPLACE FUNCTION public.proposals_guard_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status IN ('approved','rejected')
     AND NOT (
       private.has_role(auth.uid(),'super_admin'::app_role)
       OR private.has_role(auth.uid(),'admin'::app_role)
       OR private.has_role(auth.uid(),'sales_manager'::app_role)
     ) THEN
    RAISE EXCEPTION 'Only sales managers and admins can approve or reject a proposal';
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS proposals_guard_approval ON public.proposals;
CREATE TRIGGER proposals_guard_approval BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_guard_approval();

-- 7. Automatic version snapshots + timeline entries
CREATE OR REPLACE FUNCTION public.proposals_track_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.proposal_events(proposal_id, lead_id, event_type, description, actor_id)
    VALUES (NEW.id, NEW.lead_id, 'created', 'Proposal created as ' || NEW.stage, v_actor);
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.value IS DISTINCT FROM OLD.value
     OR NEW.stage IS DISTINCT FROM OLD.stage
     OR NEW.ai_content IS DISTINCT FROM OLD.ai_content
     OR NEW.description IS DISTINCT FROM OLD.description THEN
    INSERT INTO public.proposal_versions(proposal_id, version, title, description, stage, value, ai_content, notes, changed_by)
    VALUES (OLD.id, OLD.version, OLD.title, OLD.description, OLD.stage, OLD.value, OLD.ai_content, OLD.notes, v_actor);
    NEW.version := OLD.version + 1;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    IF NEW.stage = 'sent' AND NEW.sent_at IS NULL THEN NEW.sent_at := now(); END IF;
    IF NEW.stage IN ('negotiation','accepted','rejected') AND NEW.reviewed_at IS NULL THEN NEW.reviewed_at := now(); END IF;
    INSERT INTO public.proposal_events(proposal_id, lead_id, event_type, description, actor_id, metadata)
    VALUES (NEW.id, NEW.lead_id, 'stage_' || NEW.stage,
            'Stage changed from ' || OLD.stage || ' to ' || NEW.stage, v_actor,
            jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NEW.approval_status IN ('approved','rejected') THEN
      NEW.approved_by := COALESCE(NEW.approved_by, v_actor);
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    ELSIF NEW.approval_status = 'pending' THEN
      NEW.approval_requested_at := now();
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
    INSERT INTO public.proposal_events(proposal_id, lead_id, event_type, description, actor_id, metadata)
    VALUES (NEW.id, NEW.lead_id, 'approval_' || NEW.approval_status,
            'Approval status: ' || NEW.approval_status, v_actor,
            jsonb_build_object('from', OLD.approval_status, 'to', NEW.approval_status, 'notes', NEW.approval_notes));
  END IF;

  IF NEW.lead_id IS NOT NULL AND OLD.lead_id IS NULL THEN
    NEW.converted_at := COALESCE(NEW.converted_at, now());
    INSERT INTO public.proposal_events(proposal_id, lead_id, event_type, description, actor_id)
    VALUES (NEW.id, NEW.lead_id, 'converted', 'Converted to a pipeline deal', v_actor);
  END IF;

  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS proposals_track_changes_ins ON public.proposals;
CREATE TRIGGER proposals_track_changes_ins AFTER INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_track_changes();

DROP TRIGGER IF EXISTS proposals_track_changes_upd ON public.proposals;
CREATE TRIGGER proposals_track_changes_upd BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_track_changes();