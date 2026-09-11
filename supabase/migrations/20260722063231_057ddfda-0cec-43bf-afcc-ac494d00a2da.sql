
-- 1) New admin-only table
CREATE TABLE IF NOT EXISTS public.tenant_webhook_secrets (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Grants: admins only via RLS; service_role for server handlers.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_webhook_secrets TO authenticated;
GRANT ALL ON public.tenant_webhook_secrets TO service_role;
REVOKE ALL ON public.tenant_webhook_secrets FROM anon;

-- 3) RLS
ALTER TABLE public.tenant_webhook_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tws_admin_all ON public.tenant_webhook_secrets
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role)
      OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role)
           OR private.has_role(auth.uid(), 'admin'::app_role));

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS tws_set_updated_at ON public.tenant_webhook_secrets;
CREATE TRIGGER tws_set_updated_at
  BEFORE UPDATE ON public.tenant_webhook_secrets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Migrate existing secrets
INSERT INTO public.tenant_webhook_secrets (tenant_id, webhook_secret)
SELECT id, webhook_secret FROM public.tenants
WHERE webhook_secret IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

-- 6) Drop the column from public.tenants so it can never leak again
ALTER TABLE public.tenants DROP COLUMN IF EXISTS webhook_secret;

-- 7) Auto-create a random secret when a new tenant is inserted, so admins
--    always have one available without exposing it on the tenants row.
CREATE OR REPLACE FUNCTION public.tenants_create_webhook_secret()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_webhook_secrets (tenant_id, webhook_secret)
  VALUES (NEW.id, encode(gen_random_bytes(24), 'hex'))
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_after_insert_secret ON public.tenants;
CREATE TRIGGER tenants_after_insert_secret
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.tenants_create_webhook_secret();
