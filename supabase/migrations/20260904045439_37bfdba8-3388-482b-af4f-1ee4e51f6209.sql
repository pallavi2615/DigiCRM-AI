-- =========================================================
-- Industry pack engine
-- =========================================================
CREATE TABLE public.pack_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  group_slug TEXT NOT NULL,
  pack_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  value NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  source TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  next_action_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  won BOOLEAN,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pack_records_pack ON public.pack_records(group_slug, pack_slug);
CREATE INDEX idx_pack_records_stage ON public.pack_records(pack_slug, stage);
CREATE INDEX idx_pack_records_owner ON public.pack_records(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_records TO authenticated;
GRANT ALL ON public.pack_records TO service_role;
ALTER TABLE public.pack_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pack_records_select" ON public.pack_records
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR owner_id = auth.uid() OR assigned_to = auth.uid() OR created_by = auth.uid()
);

CREATE POLICY "pack_records_insert" ON public.pack_records
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND owner_id IS NOT NULL);

CREATE POLICY "pack_records_update" ON public.pack_records
FOR UPDATE TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR owner_id = auth.uid() OR assigned_to = auth.uid() OR created_by = auth.uid()
);

CREATE POLICY "pack_records_delete" ON public.pack_records
FOR DELETE TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
);

CREATE TRIGGER pack_records_updated_at BEFORE UPDATE ON public.pack_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER pack_records_audit AFTER INSERT OR UPDATE OR DELETE ON public.pack_records
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- =========================================================
-- DigiVerify
-- =========================================================
CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  record_id UUID REFERENCES public.pack_records(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  subject_name TEXT,
  identifier_masked TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'digiverify',
  score INTEGER,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_record ON public.verifications(record_id);
CREATE INDEX idx_verifications_kind ON public.verifications(kind, status);

GRANT SELECT, INSERT ON public.verifications TO authenticated;
GRANT ALL ON public.verifications TO service_role;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifications_select" ON public.verifications
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR requested_by = auth.uid()
);

CREATE POLICY "verifications_insert" ON public.verifications
FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid());

-- =========================================================
-- Industry AI agent runs
-- =========================================================
CREATE TABLE public.pack_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  group_slug TEXT NOT NULL,
  pack_slug TEXT NOT NULL,
  agent_key TEXT NOT NULL,
  record_id UUID REFERENCES public.pack_records(id) ON DELETE CASCADE,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pack_agent_runs_pack ON public.pack_agent_runs(pack_slug, created_at DESC);

GRANT SELECT, INSERT ON public.pack_agent_runs TO authenticated;
GRANT ALL ON public.pack_agent_runs TO service_role;
ALTER TABLE public.pack_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pack_agent_runs_select" ON public.pack_agent_runs
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR created_by = auth.uid()
);

CREATE POLICY "pack_agent_runs_insert" ON public.pack_agent_runs
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());