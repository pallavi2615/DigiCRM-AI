-- 1. Role management policies (hierarchy enforced, no self-escalation)
CREATE POLICY "super_admin manages all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admin manages junior roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    AND user_id <> auth.uid()
    AND role IN ('sales_manager'::app_role, 'sales_executive'::app_role)
  );

CREATE POLICY "admin updates junior roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    AND user_id <> auth.uid()
    AND role IN ('sales_manager'::app_role, 'sales_executive'::app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    AND user_id <> auth.uid()
    AND role IN ('sales_manager'::app_role, 'sales_executive'::app_role)
  );

CREATE POLICY "admin deletes junior roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    AND user_id <> auth.uid()
    AND role IN ('sales_manager'::app_role, 'sales_executive'::app_role)
  );

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 2. Backfill workspace membership so ticket RLS (tenant-scoped) works
INSERT INTO public.tenant_members (tenant_id, user_id, member_role)
SELECT t.id, u.id,
       CASE WHEN t.owner_id = u.id THEN 'owner' ELSE 'agent' END
FROM public.tenants t
CROSS JOIN auth.users u
ON CONFLICT DO NOTHING;

-- 3. New users automatically join the default workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first BOOLEAN;
  v_tenant UUID;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'super_admin'::app_role ELSE 'sales_executive'::app_role END);

  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF v_tenant IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, member_role)
    VALUES (v_tenant, NEW.id, 'agent')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;