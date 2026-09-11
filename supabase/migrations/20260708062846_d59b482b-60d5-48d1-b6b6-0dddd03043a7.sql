
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "activities insert" ON public.activities;
CREATE POLICY "activities insert own" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
