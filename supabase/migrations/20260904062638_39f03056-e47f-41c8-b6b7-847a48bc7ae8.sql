ALTER TABLE public.pack_configs
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS gradient text,
  ADD COLUMN IF NOT EXISTS kpi_labels jsonb,
  ADD COLUMN IF NOT EXISTS verifications jsonb,
  ADD COLUMN IF NOT EXISTS lost_stages jsonb,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE POLICY "pack_records_select_own_email"
  ON public.pack_records FOR SELECT TO authenticated
  USING (contact_email IS NOT NULL AND lower(contact_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "pack_documents_select_own_email"
  ON public.pack_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pack_records r
    WHERE r.id = pack_documents.record_id
      AND r.contact_email IS NOT NULL
      AND lower(r.contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));

CREATE POLICY "pack_payments_select_own_email"
  ON public.pack_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pack_records r
    WHERE r.id = pack_payments.record_id
      AND r.contact_email IS NOT NULL
      AND lower(r.contact_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ));