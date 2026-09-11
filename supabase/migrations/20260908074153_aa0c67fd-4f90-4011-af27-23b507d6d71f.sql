CREATE TABLE public.pack_ai_training (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_slug TEXT NOT NULL,
  pack_slug TEXT NOT NULL,
  glossary TEXT,
  tone TEXT,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, group_slug, pack_slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_ai_training TO authenticated;
GRANT ALL ON public.pack_ai_training TO service_role;
ALTER TABLE public.pack_ai_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read their AI training"
  ON public.pack_ai_training FOR SELECT TO authenticated
  USING (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Workspace members write their AI training"
  ON public.pack_ai_training FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Workspace members update their AI training"
  ON public.pack_ai_training FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Workspace members delete their AI training"
  ON public.pack_ai_training FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE TRIGGER pack_ai_training_updated_at BEFORE UPDATE ON public.pack_ai_training
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  group_slug TEXT,
  pack_slug TEXT,
  model TEXT,
  prompt_chars INTEGER NOT NULL DEFAULT 0,
  response_chars INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or workspace AI usage"
  ON public.ai_usage_log FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR private.is_admin(auth.uid())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()))
  );

CREATE POLICY "Log own AI usage"
  ON public.ai_usage_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX ai_usage_log_tenant_idx ON public.ai_usage_log (tenant_id, created_at DESC);
CREATE INDEX pack_records_tenant_pack_idx ON public.pack_records (tenant_id, group_slug, pack_slug);