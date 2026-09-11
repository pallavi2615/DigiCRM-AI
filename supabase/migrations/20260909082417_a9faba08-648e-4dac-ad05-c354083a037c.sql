
CREATE TABLE public.affiliate_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','paid','rejected')),
  reference TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.affiliate_payout_requests TO authenticated;
GRANT UPDATE, DELETE ON public.affiliate_payout_requests TO authenticated;
GRANT ALL ON public.affiliate_payout_requests TO service_role;

ALTER TABLE public.affiliate_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apr_select_own_or_admin" ON public.affiliate_payout_requests
FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR affiliate_id IN (SELECT a.id FROM public.affiliates a WHERE a.user_id = auth.uid())
);

CREATE POLICY "apr_insert_own" ON public.affiliate_payout_requests
FOR INSERT TO authenticated
WITH CHECK (
  status = 'requested'
  AND processed_by IS NULL
  AND processed_at IS NULL
  AND affiliate_id IN (
    SELECT a.id FROM public.affiliates a
    WHERE a.user_id = auth.uid() AND a.status = 'approved'
  )
);

CREATE POLICY "apr_admin_update" ON public.affiliate_payout_requests
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'super_admin'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "apr_admin_delete" ON public.affiliate_payout_requests
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'super_admin'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER apr_updated_at BEFORE UPDATE ON public.affiliate_payout_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-workspace payout summary for the calling partner
CREATE OR REPLACE FUNCTION public.affiliate_payout_summary()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  referrals BIGINT,
  won_referrals BIGINT,
  base_amount NUMERIC,
  commission_pct NUMERIC,
  earned NUMERIC,
  requested NUMERIC,
  paid NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT a.id, a.commission_pct FROM public.affiliates a
    WHERE a.user_id = auth.uid() AND a.status = 'approved'
    LIMIT 1
  ),
  refs AS (
    SELECT l.tenant_id,
           count(*) AS referrals,
           count(*) FILTER (WHERE l.status = 'won'::lead_status) AS won_referrals
    FROM public.leads l, me
    WHERE l.affiliate_id = me.id
    GROUP BY l.tenant_id
  ),
  comm AS (
    SELECT l.tenant_id,
           sum(c.base_amount) AS base_amount,
           sum(c.commission_amount) AS earned
    FROM public.affiliate_commissions c
    JOIN public.leads l ON l.id = c.lead_id, me
    WHERE c.affiliate_id = me.id AND c.status <> 'cancelled'
    GROUP BY l.tenant_id
  ),
  reqs AS (
    SELECT r.tenant_id,
           sum(r.amount) FILTER (WHERE r.status IN ('requested','approved')) AS requested,
           sum(r.amount) FILTER (WHERE r.status = 'paid') AS paid
    FROM public.affiliate_payout_requests r, me
    WHERE r.affiliate_id = me.id
    GROUP BY r.tenant_id
  ),
  keys AS (
    SELECT tenant_id FROM refs
    UNION SELECT tenant_id FROM comm
    UNION SELECT tenant_id FROM reqs
  )
  SELECT k.tenant_id,
         t.name,
         COALESCE(refs.referrals, 0),
         COALESCE(refs.won_referrals, 0),
         COALESCE(comm.base_amount, 0),
         (SELECT me.commission_pct FROM me),
         COALESCE(comm.earned, 0),
         COALESCE(reqs.requested, 0),
         COALESCE(reqs.paid, 0)
  FROM keys k
  LEFT JOIN public.tenants t ON t.id = k.tenant_id
  LEFT JOIN refs ON refs.tenant_id IS NOT DISTINCT FROM k.tenant_id
  LEFT JOIN comm ON comm.tenant_id IS NOT DISTINCT FROM k.tenant_id
  LEFT JOIN reqs ON reqs.tenant_id IS NOT DISTINCT FROM k.tenant_id
  ORDER BY 7 DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.affiliate_payout_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.affiliate_payout_summary() TO authenticated;

-- Clients can see verification results on their own application
CREATE POLICY "verifications_select_own_record" ON public.verifications
FOR SELECT TO authenticated
USING (
  record_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pack_records r
    WHERE r.id = verifications.record_id
      AND r.contact_email IS NOT NULL
      AND lower(r.contact_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
);
