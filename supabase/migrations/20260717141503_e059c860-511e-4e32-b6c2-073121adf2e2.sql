
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'lite' CHECK (plan IN ('lite','prime')),
  tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  accent_color TEXT DEFAULT '#8B5CF6',
  industry TEXT,
  custom_domain TEXT UNIQUE,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'agent' CHECK (member_role IN ('owner','agent','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.tenant_members WHERE tenant_id=_tenant AND user_id=_user);
$$;

CREATE POLICY "tenants_admin_all" ON public.tenants FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "tenants_members_read" ON public.tenants FOR SELECT TO authenticated
  USING (public.is_tenant_member(id, auth.uid()));
CREATE POLICY "tenants_owner_update" ON public.tenants FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tenants_public_read" ON public.tenants FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "tm_admin_all" ON public.tenant_members FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "tm_self_read" ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "tm_owner_manage" ON public.tenant_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid()));

CREATE TRIGGER trg_tenants_upd BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL CHECK (plan IN ('lite','prime')),
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  numeric_limit INTEGER,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan, feature_key)
);
GRANT SELECT ON public.plan_features TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.plan_features TO authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pf_read_all" ON public.plan_features FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pf_super_admin_write" ON public.plan_features FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role));

INSERT INTO public.plan_features (plan, feature_key, enabled, numeric_limit, description) VALUES
  ('lite','tickets.basic',true,null,'Basic ticket CRUD, statuses, priority'),
  ('prime','tickets.basic',true,null,'Basic ticket CRUD, statuses, priority'),
  ('lite','tickets.sla_custom',false,null,'Custom SLA policies per priority'),
  ('prime','tickets.sla_custom',true,null,'Custom SLA policies per priority'),
  ('lite','tickets.automations',false,null,'Automation rules engine'),
  ('prime','tickets.automations',true,null,'Automation rules engine'),
  ('lite','tickets.macros',false,null,'One-click ticket macros'),
  ('prime','tickets.macros',true,null,'One-click ticket macros'),
  ('lite','tickets.customer_portal',true,null,'Public customer portal'),
  ('prime','tickets.customer_portal',true,null,'Public customer portal'),
  ('lite','whitelabel.branding',true,null,'Basic logo + color branding'),
  ('prime','whitelabel.branding',true,null,'Full white-label branding'),
  ('lite','whitelabel.custom_domain',false,null,'Custom domain mapping'),
  ('prime','whitelabel.custom_domain',true,null,'Custom domain mapping'),
  ('lite','industry_landing_pages',true,1,'Industry landing pages'),
  ('prime','industry_landing_pages',true,null,'Industry landing pages (unlimited)'),
  ('lite','inbound.webhook',true,null,'Inbound lead webhook'),
  ('prime','inbound.webhook',true,null,'Inbound lead webhook'),
  ('lite','inbound.google_sheets',false,null,'Google Sheets sync'),
  ('prime','inbound.google_sheets',true,null,'Google Sheets sync'),
  ('lite','inbound.facebook',false,null,'Facebook Lead Ads'),
  ('prime','inbound.facebook',true,null,'Facebook Lead Ads'),
  ('lite','ai.assistant',true,50,'AI Assistant (limited quota)'),
  ('prime','ai.assistant',true,null,'AI Assistant (unlimited)'),
  ('lite','users.max',true,3,'Max users per tenant'),
  ('prime','users.max',true,null,'Max users per tenant');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_number BIGSERIAL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  channel TEXT NOT NULL DEFAULT 'portal' CHECK (channel IN ('email','portal','form','api','chat')),
  requester_email TEXT NOT NULL,
  requester_name TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  sla_breached BOOLEAN NOT NULL DEFAULT false,
  linked_lead_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "st_admin_all" ON public.support_tickets FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "st_tenant_member" ON public.support_tickets FOR ALL TO authenticated
  USING (tenant_id IS NULL OR public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (tenant_id IS NULL OR public.is_tenant_member(tenant_id, auth.uid()));

CREATE TRIGGER trg_st_upd BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_st_tenant ON public.support_tickets(tenant_id);
CREATE INDEX idx_st_status ON public.support_tickets(status);
CREATE INDEX idx_st_assignee ON public.support_tickets(assignee_id);

CREATE OR REPLACE FUNCTION public.compute_ticket_sla()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  mins INT;
BEGIN
  IF NEW.priority = 'urgent' THEN mins := 60;
  ELSIF NEW.priority = 'high' THEN mins := 240;
  ELSIF NEW.priority = 'normal' THEN mins := 1440;
  ELSE mins := 2880; END IF;
  IF NEW.sla_due_at IS NULL THEN
    NEW.sla_due_at := COALESCE(NEW.created_at, now()) + (mins || ' minutes')::INTERVAL;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_st_sla BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.compute_ticket_sla();

CREATE TABLE public.ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email TEXT,
  author_name TEXT,
  body TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_replies TO authenticated;
GRANT ALL ON public.ticket_replies TO service_role;
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_admin_all" ON public.ticket_replies FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "tr_ticket_member" ON public.ticket_replies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
                  AND (t.tenant_id IS NULL OR public.is_tenant_member(t.tenant_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
                  AND (t.tenant_id IS NULL OR public.is_tenant_member(t.tenant_id, auth.uid()))));
CREATE INDEX idx_tr_ticket ON public.ticket_replies(ticket_id);

CREATE OR REPLACE FUNCTION public.mark_first_response()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.author_id IS NOT NULL AND NEW.is_public THEN
    UPDATE public.support_tickets
       SET first_response_at = COALESCE(first_response_at, now())
     WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_tr_first_resp AFTER INSERT ON public.ticket_replies
  FOR EACH ROW EXECUTE FUNCTION public.mark_first_response();

CREATE TABLE public.canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.canned_responses TO authenticated;
GRANT ALL ON public.canned_responses TO service_role;
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cr_all" ON public.canned_responses FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())));

CREATE TABLE public.ticket_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT,
  actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_macros TO authenticated;
GRANT ALL ON public.ticket_macros TO service_role;
ALTER TABLE public.ticket_macros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tm_all" ON public.ticket_macros FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())));

CREATE TABLE public.sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
  first_response_mins INTEGER NOT NULL,
  resolve_mins INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, priority)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_policies TO authenticated;
GRANT ALL ON public.sla_policies TO service_role;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_all" ON public.sla_policies FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())));

CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ar_all" ON public.automation_rules FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())));

CREATE TABLE public.inbound_webhooks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ok BOOLEAN NOT NULL,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inbound_webhooks_log TO authenticated;
GRANT ALL ON public.inbound_webhooks_log TO service_role;
ALTER TABLE public.inbound_webhooks_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iwl_read" ON public.inbound_webhooks_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())));
CREATE INDEX idx_iwl_tenant_created ON public.inbound_webhooks_log(tenant_id, created_at DESC);

CREATE TABLE public.sheet_sync_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  range_a1 TEXT NOT NULL,
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_interval TEXT NOT NULL DEFAULT 'manual' CHECK (sync_interval IN ('manual','hourly','daily')),
  last_run_at TIMESTAMPTZ,
  last_row_count INTEGER,
  last_status TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sheet_sync_configs TO authenticated;
GRANT ALL ON public.sheet_sync_configs TO service_role;
ALTER TABLE public.sheet_sync_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ssc_all" ON public.sheet_sync_configs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id, auth.uid())));

CREATE TABLE public.tenant_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  industry TEXT NOT NULL,
  title TEXT NOT NULL,
  hero_headline TEXT NOT NULL,
  hero_subheadline TEXT,
  cta_label TEXT DEFAULT 'Get started',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  testimonial TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_landing_pages TO authenticated;
GRANT SELECT ON public.tenant_landing_pages TO anon;
GRANT ALL ON public.tenant_landing_pages TO service_role;
ALTER TABLE public.tenant_landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tlp_admin_all" ON public.tenant_landing_pages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)
      OR public.is_tenant_member(tenant_id, auth.uid()));
CREATE POLICY "tlp_public_read" ON public.tenant_landing_pages FOR SELECT TO anon
  USING (is_published = true);
CREATE TRIGGER trg_tlp_upd BEFORE UPDATE ON public.tenant_landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON public.companies(tenant_id);

ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_replies REPLICA IDENTITY FULL;
ALTER TABLE public.tenants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenants;
