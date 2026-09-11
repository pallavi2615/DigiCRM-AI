
-- Enable realtime replication for CRM tables (idempotent).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads','contacts','companies','tasks','meetings',
    'it_tickets','it_projects','re_properties','re_clients','re_deals'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN others THEN NULL;
    END;
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
    END;
  END LOOP;
END $$;

-- Affiliate management: extend affiliates table with admin-managed fields.
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- Admin-only update policy on affiliates.
DROP POLICY IF EXISTS "Admins can manage affiliates" ON public.affiliates;
CREATE POLICY "Admins can manage affiliates"
  ON public.affiliates FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin') OR private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'super_admin') OR private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete affiliates" ON public.affiliates;
CREATE POLICY "Admins can delete affiliates"
  ON public.affiliates FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin') OR private.has_role(auth.uid(), 'admin'));

-- Add affiliates to realtime as well.
DO $$ BEGIN
  BEGIN ALTER TABLE public.affiliates REPLICA IDENTITY FULL; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.affiliates; EXCEPTION WHEN others THEN NULL; END;
END $$;
