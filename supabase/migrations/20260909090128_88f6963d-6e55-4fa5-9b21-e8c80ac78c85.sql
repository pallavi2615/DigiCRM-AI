
-- 1. Self-selection of industry at signup (only when the person has none yet)
CREATE OR REPLACE FUNCTION private.industry_count(_user uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.user_industry_access WHERE user_id = _user;
$$;

CREATE POLICY "uia self claim once"
ON public.user_industry_access
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND private.industry_count(auth.uid()) = 0);

-- 2. Client-recorded pack fee payments
ALTER TABLE public.pack_payments
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS payer_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS decision_note text;

-- Clients may record a payment claim on their own application only.
CREATE POLICY "pack_payments_update_own_email"
ON public.pack_payments
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pack_records r
  WHERE r.id = pack_payments.record_id
    AND r.contact_email IS NOT NULL
    AND lower(r.contact_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.pack_records r
  WHERE r.id = pack_payments.record_id
    AND r.contact_email IS NOT NULL
    AND lower(r.contact_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
));
