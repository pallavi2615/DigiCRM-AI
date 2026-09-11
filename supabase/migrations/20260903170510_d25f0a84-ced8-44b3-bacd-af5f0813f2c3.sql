-- Managers/admins may see archived (soft-deleted) rows so archiving works and
-- restore/audit views can list them. Regular users still only see active rows.
DROP POLICY IF EXISTS "leads read" ON public.leads;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
USING (
  private.is_manager_or_above(auth.uid())
  OR (deleted_at IS NULL AND (assigned_to = auth.uid() OR created_by = auth.uid()))
);

DROP POLICY IF EXISTS "contacts read" ON public.contacts;
CREATE POLICY "contacts read" ON public.contacts FOR SELECT TO authenticated
USING (
  private.is_manager_or_above(auth.uid())
  OR (deleted_at IS NULL AND (
    created_by = auth.uid()
    OR company_id IN (SELECT c.id FROM public.companies c WHERE c.created_by = auth.uid())
    OR company_id IN (SELECT l.company_id FROM public.leads l WHERE l.company_id IS NOT NULL AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
  ))
);

DROP POLICY IF EXISTS "companies read" ON public.companies;
CREATE POLICY "companies read" ON public.companies FOR SELECT TO authenticated
USING (
  private.is_manager_or_above(auth.uid())
  OR (deleted_at IS NULL AND (
    created_by = auth.uid()
    OR id IN (SELECT l.company_id FROM public.leads l WHERE l.company_id IS NOT NULL AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
  ))
);