
-- Tighten SELECT for companies and contacts

DROP POLICY IF EXISTS "companies read" ON public.companies;
CREATE POLICY "companies read" ON public.companies
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    private.is_manager_or_above(auth.uid())
    OR created_by = auth.uid()
    OR id IN (
      SELECT company_id FROM public.leads
      WHERE company_id IS NOT NULL
        AND (assigned_to = auth.uid() OR created_by = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "contacts read" ON public.contacts;
CREATE POLICY "contacts read" ON public.contacts
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    private.is_manager_or_above(auth.uid())
    OR created_by = auth.uid()
    OR company_id IN (
      SELECT id FROM public.companies
      WHERE created_by = auth.uid()
    )
    OR company_id IN (
      SELECT company_id FROM public.leads
      WHERE company_id IS NOT NULL
        AND (assigned_to = auth.uid() OR created_by = auth.uid())
    )
  )
);
