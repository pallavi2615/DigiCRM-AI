
CREATE TABLE IF NOT EXISTS public.lead_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  default_group_slug text,
  default_pack_slug text,
  monthly_cost numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS public.lead_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.lead_channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  budget numeric DEFAULT 0,
  starts_on date,
  ends_on date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS public.lead_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  pack_record_id uuid REFERENCES public.pack_records(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.lead_channels(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.lead_campaigns(id) ON DELETE SET NULL,
  industry_group text,
  group_slug text,
  pack_slug text,
  stage text NOT NULL DEFAULT 'New',
  status text NOT NULL DEFAULT 'open',
  revenue numeric NOT NULL DEFAULT 0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.lead_channels(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.lead_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS external_ref text;
ALTER TABLE public.pack_records ADD COLUMN IF NOT EXISTS channel_id uuid REFERENCES public.lead_channels(id) ON DELETE SET NULL;
ALTER TABLE public.pack_records ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.lead_campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.pack_records ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_conversions_channel ON public.lead_conversions(channel_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversions_campaign ON public.lead_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_conversions_group ON public.lead_conversions(industry_group);
CREATE INDEX IF NOT EXISTS idx_leads_channel ON public.leads(channel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_conversions TO authenticated;
GRANT ALL ON public.lead_channels TO service_role;
GRANT ALL ON public.lead_campaigns TO service_role;
GRANT ALL ON public.lead_conversions TO service_role;

ALTER TABLE public.lead_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lc_select ON public.lead_channels;
CREATE POLICY lc_select ON public.lead_channels FOR SELECT TO authenticated
  USING (private.can_see_industry(default_group_slug));
DROP POLICY IF EXISTS lc_write ON public.lead_channels;
CREATE POLICY lc_write ON public.lead_channels FOR ALL TO authenticated
  USING (private.is_manager_or_above(auth.uid()))
  WITH CHECK (private.is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS lcamp_select ON public.lead_campaigns;
CREATE POLICY lcamp_select ON public.lead_campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS lcamp_write ON public.lead_campaigns;
CREATE POLICY lcamp_write ON public.lead_campaigns FOR ALL TO authenticated
  USING (private.is_manager_or_above(auth.uid()))
  WITH CHECK (private.is_manager_or_above(auth.uid()));

DROP POLICY IF EXISTS lconv_select ON public.lead_conversions;
CREATE POLICY lconv_select ON public.lead_conversions FOR SELECT TO authenticated
  USING (private.can_see_industry(industry_group));
DROP POLICY IF EXISTS lconv_write ON public.lead_conversions;
CREATE POLICY lconv_write ON public.lead_conversions FOR ALL TO authenticated
  USING (private.is_manager_or_above(auth.uid()))
  WITH CHECK (private.is_manager_or_above(auth.uid()));
