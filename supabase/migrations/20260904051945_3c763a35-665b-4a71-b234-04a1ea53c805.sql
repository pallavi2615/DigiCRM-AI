CREATE TABLE public.module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  kind text NOT NULL DEFAULT 'module',
  label text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX module_settings_key_tenant_uniq
  ON public.module_settings (module_key, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_settings TO authenticated;
GRANT ALL ON public.module_settings TO service_role;

ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY module_settings_select ON public.module_settings
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin'::app_role)
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  );

CREATE POLICY module_settings_insert ON public.module_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY module_settings_update ON public.module_settings
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY module_settings_delete ON public.module_settings
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER module_settings_updated_at
  BEFORE UPDATE ON public.module_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER module_settings_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.module_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();