CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'draft',
  value NUMERIC NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 50,
  close_date DATE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  ai_content TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT proposals_stage_check CHECK (stage IN ('draft','sent','negotiation','accepted','rejected')),
  CONSTRAINT proposals_probability_check CHECK (probability >= 0 AND probability <= 100),
  CONSTRAINT proposals_value_check CHECK (value >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view proposals in scope"
  ON public.proposals FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin')
    OR private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'sales_manager')
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Signed-in users can create their own proposals"
  ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND owner_id IS NOT NULL);

CREATE POLICY "Owners and managers can update proposals"
  ON public.proposals FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin')
    OR private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'sales_manager')
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'super_admin')
    OR private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'sales_manager')
    OR owner_id = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "Managers and admins can delete proposals"
  ON public.proposals FOR DELETE TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin')
    OR private.has_role(auth.uid(), 'admin')
    OR private.has_role(auth.uid(), 'sales_manager')
  );

CREATE TRIGGER proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER proposals_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE INDEX proposals_owner_idx ON public.proposals(owner_id);
CREATE INDEX proposals_stage_idx ON public.proposals(stage);
CREATE INDEX proposals_lead_idx ON public.proposals(lead_id);