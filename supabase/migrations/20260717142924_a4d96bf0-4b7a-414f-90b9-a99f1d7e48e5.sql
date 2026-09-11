
DROP POLICY IF EXISTS "Anyone can insert landing events" ON public.landing_page_events;

CREATE POLICY "Anyone can insert landing events for active tenants"
  ON public.landing_page_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.is_active = true)
    AND char_length(coalesce(page_slug,'')) BETWEEN 1 AND 100
    AND event_type IN ('view','submit','bounce','engaged')
  );
