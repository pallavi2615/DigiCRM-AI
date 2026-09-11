DROP POLICY IF EXISTS "tasks delete" ON public.tasks;
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
USING (private.is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS "meetings delete" ON public.meetings;
CREATE POLICY "meetings delete" ON public.meetings FOR DELETE TO authenticated
USING (private.is_manager_or_above(auth.uid()));