
-- support_tickets: remove NULL tenant bypass
DROP POLICY IF EXISTS st_tenant_member ON public.support_tickets;
CREATE POLICY st_tenant_member ON public.support_tickets
  FOR ALL
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid()));

-- ticket_replies: remove NULL tenant bypass
DROP POLICY IF EXISTS tr_ticket_member ON public.ticket_replies;
CREATE POLICY tr_ticket_member ON public.ticket_replies
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_replies.ticket_id
      AND t.tenant_id IS NOT NULL
      AND public.is_tenant_member(t.tenant_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_replies.ticket_id
      AND t.tenant_id IS NOT NULL
      AND public.is_tenant_member(t.tenant_id, auth.uid())
  ));

-- contact_submissions: replace always-true WITH CHECK with basic input validation
DROP POLICY IF EXISTS "contact_submissions public insert" ON public.contact_submissions;
CREATE POLICY "contact_submissions public insert" ON public.contact_submissions
  FOR INSERT
  WITH CHECK (
    length(btrim(name)) BETWEEN 1 AND 200
    AND length(email) BETWEEN 3 AND 200
    AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND (message IS NULL OR length(message) <= 5000)
    AND handled = false
  );
