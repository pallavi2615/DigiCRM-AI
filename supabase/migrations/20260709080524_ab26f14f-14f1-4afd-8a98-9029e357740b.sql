
-- 1) Private schema for role helpers (removes them from the exposed public API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin')) $$;

CREATE OR REPLACE FUNCTION private.is_manager_or_above(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin','sales_manager')) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_manager_or_above(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_manager_or_above(uuid) TO authenticated, service_role;

-- 2) Recreate all policies that referenced public.<helper> to point at private.<helper>

-- user_roles
DROP POLICY IF EXISTS "roles view own" ON public.user_roles;
CREATE POLICY "roles view own" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_admin(auth.uid()));

-- companies
DROP POLICY IF EXISTS "companies update" ON public.companies;
CREATE POLICY "companies update" ON public.companies FOR UPDATE TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "companies delete admin" ON public.companies;
CREATE POLICY "companies delete admin" ON public.companies FOR DELETE TO authenticated
USING (private.is_admin(auth.uid()));

-- contacts
DROP POLICY IF EXISTS "contacts update" ON public.contacts;
CREATE POLICY "contacts update" ON public.contacts FOR UPDATE TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "contacts delete admin" ON public.contacts;
CREATE POLICY "contacts delete admin" ON public.contacts FOR DELETE TO authenticated
USING (private.is_admin(auth.uid()));

-- leads
DROP POLICY IF EXISTS "leads read" ON public.leads;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
USING (deleted_at IS NULL AND (private.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid()));
DROP POLICY IF EXISTS "leads update" ON public.leads;
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "leads delete" ON public.leads;
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated
USING (private.is_admin(auth.uid()));

-- tasks
DROP POLICY IF EXISTS "tasks read" ON public.tasks;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
USING (private.is_admin(auth.uid()) OR created_by = auth.uid());

-- meetings
DROP POLICY IF EXISTS "meetings read" ON public.meetings;
CREATE POLICY "meetings read" ON public.meetings FOR SELECT TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR organizer = auth.uid() OR auth.uid() = ANY (participants));
DROP POLICY IF EXISTS "meetings update" ON public.meetings;
CREATE POLICY "meetings update" ON public.meetings FOR UPDATE TO authenticated
USING (private.is_manager_or_above(auth.uid()) OR organizer = auth.uid());
DROP POLICY IF EXISTS "meetings delete" ON public.meetings;
CREATE POLICY "meetings delete" ON public.meetings FOR DELETE TO authenticated
USING (private.is_admin(auth.uid()) OR organizer = auth.uid());

-- activities (audit log)
DROP POLICY IF EXISTS "activities read admin all" ON public.activities;
CREATE POLICY "activities read admin all" ON public.activities FOR SELECT TO authenticated
USING (private.is_admin(auth.uid()) OR actor_id = auth.uid());

-- 3) Tighten profiles: self + managers/admins only (was public to all authenticated)
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles read self or elevated" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR private.is_manager_or_above(auth.uid()));

-- 4) Drop the public helper functions now that no policy references them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_admin(uuid);
DROP FUNCTION IF EXISTS public.is_manager_or_above(uuid);
