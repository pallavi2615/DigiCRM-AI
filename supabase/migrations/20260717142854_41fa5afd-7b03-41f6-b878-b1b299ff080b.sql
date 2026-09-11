
-- Landing page analytics
CREATE TABLE public.landing_page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_slug text NOT NULL DEFAULT 'home',
  event_type text NOT NULL CHECK (event_type IN ('view','submit','bounce','engaged')),
  session_id text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  user_agent text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_landing_events_tenant_created ON public.landing_page_events(tenant_id, created_at DESC);
CREATE INDEX idx_landing_events_session ON public.landing_page_events(session_id);

GRANT SELECT, INSERT ON public.landing_page_events TO authenticated;
GRANT INSERT ON public.landing_page_events TO anon;
GRANT ALL ON public.landing_page_events TO service_role;

ALTER TABLE public.landing_page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert landing events"
  ON public.landing_page_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Tenant members can view landing events"
  ON public.landing_page_events FOR SELECT
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin'::app_role) OR
    private.has_role(auth.uid(), 'admin'::app_role) OR
    public.is_tenant_member(tenant_id, auth.uid())
  );

-- Affiliate referral tracking on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_affiliate ON public.leads(affiliate_id);

-- Affiliate commissions table
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  base_amount numeric NOT NULL DEFAULT 0,
  commission_pct numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','void')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_aff_comm_affiliate ON public.affiliate_commissions(affiliate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage affiliate commissions"
  ON public.affiliate_commissions FOR ALL
  TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin'::app_role) OR
    private.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'super_admin'::app_role) OR
    private.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Affiliate can view own commissions"
  ON public.affiliate_commissions FOR SELECT
  TO authenticated
  USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );

CREATE TRIGGER trg_aff_comm_updated BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add urgency field to support tickets (distinct from priority)
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low','normal','high','critical'));

-- Add HMAC secret preference toggle on tenants (for webhook signature verification)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS webhook_hmac_enabled boolean NOT NULL DEFAULT false;
