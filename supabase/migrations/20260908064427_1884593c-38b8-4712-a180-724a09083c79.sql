
CREATE TABLE IF NOT EXISTS public.user_industry_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  industry_group text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, industry_group)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_industry_access TO authenticated;
GRANT ALL ON public.user_industry_access TO service_role;
ALTER TABLE public.user_industry_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uia self read" ON public.user_industry_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_admin(auth.uid()));
CREATE POLICY "uia admin write" ON public.user_industry_access
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

-- Which industry groups the caller may work in. Admins and Super Admins are unrestricted.
CREATE OR REPLACE FUNCTION private.can_see_industry(_group text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
  SELECT
    private.is_admin(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.user_industry_access WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_industry_access
      WHERE user_id = auth.uid() AND industry_group = _group
    );
$$;

ALTER TABLE public.leads            ADD COLUMN IF NOT EXISTS industry_group text;
ALTER TABLE public.contacts         ADD COLUMN IF NOT EXISTS industry_group text;
ALTER TABLE public.companies        ADD COLUMN IF NOT EXISTS industry_group text;
ALTER TABLE public.tasks            ADD COLUMN IF NOT EXISTS industry_group text;
ALTER TABLE public.meetings         ADD COLUMN IF NOT EXISTS industry_group text;
ALTER TABLE public.proposals        ADD COLUMN IF NOT EXISTS industry_group text;
ALTER TABLE public.support_tickets  ADD COLUMN IF NOT EXISTS industry_group text;

CREATE INDEX IF NOT EXISTS leads_industry_group_idx           ON public.leads(industry_group);
CREATE INDEX IF NOT EXISTS contacts_industry_group_idx        ON public.contacts(industry_group);
CREATE INDEX IF NOT EXISTS companies_industry_group_idx       ON public.companies(industry_group);
CREATE INDEX IF NOT EXISTS tasks_industry_group_idx           ON public.tasks(industry_group);
CREATE INDEX IF NOT EXISTS meetings_industry_group_idx        ON public.meetings(industry_group);
CREATE INDEX IF NOT EXISTS proposals_industry_group_idx       ON public.proposals(industry_group);
CREATE INDEX IF NOT EXISTS support_tickets_industry_group_idx ON public.support_tickets(industry_group);

-- Stamp new rows with the creator's primary industry when not supplied.
CREATE OR REPLACE FUNCTION public.set_industry_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.industry_group IS NULL AND auth.uid() IS NOT NULL THEN
    SELECT industry_group INTO NEW.industry_group
      FROM public.user_industry_access
     WHERE user_id = auth.uid()
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_industry_group ON public.leads;
CREATE TRIGGER leads_industry_group BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();
DROP TRIGGER IF EXISTS contacts_industry_group ON public.contacts;
CREATE TRIGGER contacts_industry_group BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();
DROP TRIGGER IF EXISTS companies_industry_group ON public.companies;
CREATE TRIGGER companies_industry_group BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();
DROP TRIGGER IF EXISTS tasks_industry_group ON public.tasks;
CREATE TRIGGER tasks_industry_group BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();
DROP TRIGGER IF EXISTS meetings_industry_group ON public.meetings;
CREATE TRIGGER meetings_industry_group BEFORE INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();
DROP TRIGGER IF EXISTS proposals_industry_group ON public.proposals;
CREATE TRIGGER proposals_industry_group BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();
DROP TRIGGER IF EXISTS support_tickets_industry_group ON public.support_tickets;
CREATE TRIGGER support_tickets_industry_group BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_industry_group();

-- Re-create the read policies with the industry gate layered on top.
DROP POLICY IF EXISTS "leads read" ON public.leads;
CREATE POLICY "leads read" ON public.leads
  FOR SELECT TO authenticated
  USING (
    private.can_see_industry(industry_group)
    AND (
      private.is_manager_or_above(auth.uid())
      OR (deleted_at IS NULL AND (assigned_to = auth.uid() OR created_by = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "contacts read" ON public.contacts;
CREATE POLICY "contacts read" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    private.can_see_industry(industry_group)
    AND (
      private.is_manager_or_above(auth.uid())
      OR (deleted_at IS NULL AND (
        created_by = auth.uid()
        OR company_id IN (SELECT c.id FROM public.companies c WHERE c.created_by = auth.uid())
        OR company_id IN (SELECT l.company_id FROM public.leads l WHERE l.company_id IS NOT NULL AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
      ))
    )
  );

DROP POLICY IF EXISTS "companies read" ON public.companies;
CREATE POLICY "companies read" ON public.companies
  FOR SELECT TO authenticated
  USING (
    private.can_see_industry(industry_group)
    AND (
      private.is_manager_or_above(auth.uid())
      OR (deleted_at IS NULL AND (
        created_by = auth.uid()
        OR id IN (SELECT l.company_id FROM public.leads l WHERE l.company_id IS NOT NULL AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
      ))
    )
  );

DROP POLICY IF EXISTS "tasks read" ON public.tasks;
CREATE POLICY "tasks read" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    private.can_see_industry(industry_group)
    AND (private.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "meetings read" ON public.meetings;
CREATE POLICY "meetings read" ON public.meetings
  FOR SELECT TO authenticated
  USING (
    private.can_see_industry(industry_group)
    AND (private.is_manager_or_above(auth.uid()) OR organizer = auth.uid() OR auth.uid() = ANY (participants))
  );

DROP POLICY IF EXISTS "Staff can view proposals in scope" ON public.proposals;
CREATE POLICY "Staff can view proposals in scope" ON public.proposals
  FOR SELECT TO authenticated
  USING (
    private.can_see_industry(industry_group)
    AND (
      private.is_manager_or_above(auth.uid())
      OR owner_id = auth.uid()
      OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "st_tenant_member" ON public.support_tickets;
CREATE POLICY "st_tenant_member" ON public.support_tickets
  FOR ALL TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()) AND private.can_see_industry(industry_group))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()) AND private.can_see_industry(industry_group));

-- Task attachments: allow uploads/reads for anyone who can see the task.
CREATE OR REPLACE FUNCTION private.can_access_entity(_entity_type text, _entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  uid uuid := auth.uid();
  ok boolean := false;
BEGIN
  IF uid IS NULL OR _entity_id IS NULL THEN
    RETURN false;
  END IF;
  IF private.is_manager_or_above(uid) THEN
    RETURN true;
  END IF;
  IF _entity_type = 'leads' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = _entity_id AND l.deleted_at IS NULL
        AND (l.assigned_to = uid OR l.created_by = uid)
    ) INTO ok;
  ELSIF _entity_type = 'tasks' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = _entity_id AND (t.assigned_to = uid OR t.created_by = uid)
    ) INTO ok;
  ELSIF _entity_type = 'contacts' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = _entity_id AND c.deleted_at IS NULL
        AND (
          c.created_by = uid
          OR c.company_id IN (SELECT id FROM public.companies WHERE created_by = uid)
          OR c.company_id IN (SELECT company_id FROM public.leads WHERE company_id IS NOT NULL AND (assigned_to = uid OR created_by = uid))
        )
    ) INTO ok;
  ELSIF _entity_type = 'companies' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.companies co
      WHERE co.id = _entity_id AND co.deleted_at IS NULL
        AND (
          co.created_by = uid
          OR co.id IN (SELECT company_id FROM public.leads WHERE company_id IS NOT NULL AND (assigned_to = uid OR created_by = uid))
        )
    ) INTO ok;
  END IF;
  RETURN COALESCE(ok, false);
END;
$$;

DROP POLICY IF EXISTS "attachments read" ON storage.objects;
CREATE POLICY "attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = ANY (ARRAY['leads','contacts','companies','tasks','re_clients','re_properties','re_deals','it_projects','it_tickets','loan_applications','loan_documents','ps_orders','ps_products'])
    AND private.can_access_entity((storage.foldername(name))[1], NULLIF((storage.foldername(name))[2], '')::uuid)
  );

DROP POLICY IF EXISTS "attachments insert" ON storage.objects;
CREATE POLICY "attachments insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = ANY (ARRAY['leads','contacts','companies','tasks','re_clients','re_properties','re_deals','it_projects','it_tickets','loan_applications','loan_documents','ps_orders','ps_products'])
    AND private.can_access_entity((storage.foldername(name))[1], NULLIF((storage.foldername(name))[2], '')::uuid)
  );
