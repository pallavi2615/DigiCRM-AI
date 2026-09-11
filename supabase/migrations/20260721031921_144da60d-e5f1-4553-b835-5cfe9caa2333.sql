
-- 1) Tenants: drop anon SELECT, expose branding-only view
DROP POLICY IF EXISTS "tenants_public_read" ON public.tenants;

CREATE OR REPLACE VIEW public.tenants_public
WITH (security_invoker = true) AS
SELECT id, slug, name, tagline, logo_url, favicon_url,
       primary_color, accent_color, industry, plan
FROM public.tenants
WHERE is_active = true;

-- Anon needs to read the view. The view uses security_invoker, so it
-- executes with the anon role's privileges on the base table; give anon
-- SELECT on a limited column list of tenants so the view resolves without
-- exposing webhook_secret or other sensitive fields.
REVOKE SELECT ON public.tenants FROM anon;
GRANT SELECT (id, slug, name, tagline, logo_url, favicon_url,
              primary_color, accent_color, industry, plan, is_active)
  ON public.tenants TO anon;

GRANT SELECT ON public.tenants_public TO anon, authenticated;

-- 2) Stop broadcasting tenants over realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.tenants;

-- 3) Restrict affiliate public inserts
DROP POLICY IF EXISTS "affiliates public insert" ON public.affiliates;

CREATE POLICY "affiliates anon insert" ON public.affiliates
  FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND commission_pct = 30
    AND user_id IS NULL
    AND approved_at IS NULL
    AND approved_by IS NULL
  );

CREATE POLICY "affiliates authenticated insert" ON public.affiliates
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND commission_pct = 30
    AND (user_id IS NULL OR user_id = auth.uid())
    AND approved_at IS NULL
    AND approved_by IS NULL
  );

-- 4) Convert is_tenant_member to SECURITY INVOKER so signed-in users
-- calling it only see their own tenant_members rows (RLS-scoped).
CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = _tenant AND user_id = _user
  );
$$;
