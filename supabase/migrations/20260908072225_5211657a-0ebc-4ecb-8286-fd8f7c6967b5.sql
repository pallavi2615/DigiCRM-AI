-- 1. Isolated tenants -------------------------------------------------------
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_isolated BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION private.can_see_tenant(_t uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public','private'
AS $$
  SELECT CASE
    WHEN private.is_admin(auth.uid()) THEN true
    WHEN EXISTS (
      SELECT 1 FROM public.tenant_members m
      JOIN public.tenants t ON t.id = m.tenant_id
      WHERE m.user_id = auth.uid() AND t.is_isolated
    ) THEN _t IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenant_members m WHERE m.user_id = auth.uid() AND m.tenant_id = _t
    )
    ELSE _t IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = _t AND t.is_isolated
    )
  END;
$$;
REVOKE ALL ON FUNCTION private.can_see_tenant(uuid) FROM PUBLIC, anon, authenticated;

-- 2. Tenant-aware read policies ---------------------------------------------
DROP POLICY IF EXISTS "leads read" ON public.leads;
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
USING (
  private.can_see_tenant(tenant_id)
  AND private.can_see_industry(industry_group)
  AND (
    private.is_manager_or_above(auth.uid())
    OR (deleted_at IS NULL AND (assigned_to = auth.uid() OR created_by = auth.uid()))
  )
);

DROP POLICY IF EXISTS "companies read" ON public.companies;
CREATE POLICY "companies read" ON public.companies FOR SELECT TO authenticated
USING (
  private.can_see_tenant(tenant_id)
  AND private.can_see_industry(industry_group)
  AND (
    private.is_manager_or_above(auth.uid())
    OR (deleted_at IS NULL AND (
      created_by = auth.uid()
      OR id IN (SELECT l.company_id FROM public.leads l WHERE l.company_id IS NOT NULL AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
    ))
  )
);

DROP POLICY IF EXISTS "contacts read" ON public.contacts;
CREATE POLICY "contacts read" ON public.contacts FOR SELECT TO authenticated
USING (
  private.can_see_tenant(tenant_id)
  AND private.can_see_industry(industry_group)
  AND (
    private.is_manager_or_above(auth.uid())
    OR (deleted_at IS NULL AND (
      created_by = auth.uid()
      OR company_id IN (SELECT c.id FROM public.companies c WHERE c.created_by = auth.uid())
      OR company_id IN (SELECT l.company_id FROM public.leads l WHERE l.company_id IS NOT NULL AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid()))
    ))
  )
);

DROP POLICY IF EXISTS "pack_records_select" ON public.pack_records;
CREATE POLICY "pack_records_select" ON public.pack_records FOR SELECT TO authenticated
USING (
  private.can_see_tenant(tenant_id)
  AND (
    private.has_role(auth.uid(),'super_admin'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'sales_manager'::app_role)
    OR owner_id = auth.uid() OR assigned_to = auth.uid() OR created_by = auth.uid()
  )
);

-- 3. Per-tenant pack configuration ------------------------------------------
ALTER TABLE public.pack_configs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public.pack_configs DROP CONSTRAINT IF EXISTS pack_configs_group_slug_pack_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS pack_configs_global_key ON public.pack_configs (group_slug, pack_slug) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pack_configs_tenant_key ON public.pack_configs (tenant_id, group_slug, pack_slug) WHERE tenant_id IS NOT NULL;

DROP POLICY IF EXISTS pack_configs_select ON public.pack_configs;
CREATE POLICY pack_configs_select ON public.pack_configs FOR SELECT TO authenticated
USING (tenant_id IS NULL OR private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid()));

DROP POLICY IF EXISTS pack_configs_insert ON public.pack_configs;
CREATE POLICY pack_configs_insert ON public.pack_configs FOR INSERT TO authenticated
WITH CHECK (
  (tenant_id IS NULL AND (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)))
  OR (tenant_id IS NOT NULL AND (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid())))
);

DROP POLICY IF EXISTS pack_configs_update ON public.pack_configs;
CREATE POLICY pack_configs_update ON public.pack_configs FOR UPDATE TO authenticated
USING (
  (tenant_id IS NULL AND (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)))
  OR (tenant_id IS NOT NULL AND (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid())))
)
WITH CHECK (
  (tenant_id IS NULL AND (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role)))
  OR (tenant_id IS NOT NULL AND (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid())))
);

DROP POLICY IF EXISTS pack_configs_delete ON public.pack_configs;
CREATE POLICY pack_configs_delete ON public.pack_configs FOR DELETE TO authenticated
USING (
  (tenant_id IS NULL AND private.has_role(auth.uid(),'super_admin'::app_role))
  OR (tenant_id IS NOT NULL AND (private.is_admin(auth.uid()) OR public.is_tenant_member(tenant_id, auth.uid())))
);

-- 4. Pack-aware proposals ----------------------------------------------------
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_slug TEXT,
  ADD COLUMN IF NOT EXISTS pack_slug TEXT,
  ADD COLUMN IF NOT EXISTS pack_record_id UUID REFERENCES public.pack_records(id) ON DELETE SET NULL;

ALTER TABLE public.proposal_templates
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS group_slug TEXT,
  ADD COLUMN IF NOT EXISTS pack_slug TEXT;

CREATE INDEX IF NOT EXISTS proposals_pack_idx ON public.proposals (group_slug, pack_slug);
CREATE INDEX IF NOT EXISTS proposals_tenant_idx ON public.proposals (tenant_id);
CREATE INDEX IF NOT EXISTS proposal_templates_pack_idx ON public.proposal_templates (group_slug, pack_slug);

DROP POLICY IF EXISTS "Staff can view proposals in scope" ON public.proposals;
CREATE POLICY "Staff can view proposals in scope" ON public.proposals FOR SELECT TO authenticated
USING (
  private.can_see_tenant(tenant_id)
  AND private.can_see_industry(industry_group)
  AND (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR created_by = auth.uid())
);

DROP POLICY IF EXISTS "Staff can read shared or own templates" ON public.proposal_templates;
CREATE POLICY "Staff can read shared or own templates" ON public.proposal_templates FOR SELECT TO authenticated
USING (
  private.can_see_tenant(tenant_id)
  AND (
    is_shared OR created_by = auth.uid()
    OR private.has_role(auth.uid(),'super_admin'::app_role)
    OR private.has_role(auth.uid(),'admin'::app_role)
    OR private.has_role(auth.uid(),'sales_manager'::app_role)
  )
);

-- 5. Apex Finserv: a real, isolated tenant -----------------------------------
CREATE OR REPLACE FUNCTION public.tenants_create_webhook_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $fn$
BEGIN
  INSERT INTO public.tenant_webhook_secrets (tenant_id, webhook_secret)
  VALUES (NEW.id, encode(extensions.gen_random_bytes(24), 'hex'))
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

DO $seed$
DECLARE
  v_owner UUID := '8739d22a-127b-4e1b-8eea-3f66b1d48ad9';
  v_tenant UUID;
  v_c1 UUID; v_c2 UUID; v_c3 UUID; v_c4 UUID;
  v_lead UUID;
  v_rec UUID;
BEGIN
  INSERT INTO public.tenants (slug, name, plan, tagline, industry, is_active, is_isolated, owner_id, primary_color, accent_color)
  VALUES ('apex-finserv','Apex Finserv','prime','Loans, done right.','financial-services',true,true,v_owner,'#0f766e','#f59e0b')
  ON CONFLICT (slug) DO UPDATE SET is_isolated = true, owner_id = EXCLUDED.owner_id
  RETURNING id INTO v_tenant;

  DELETE FROM public.tenant_members WHERE user_id = v_owner;
  INSERT INTO public.tenant_members (tenant_id, user_id, member_role) VALUES (v_tenant, v_owner, 'owner')
  ON CONFLICT DO NOTHING;

  DELETE FROM public.user_roles WHERE user_id = v_owner;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_owner, 'sales_manager'::app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.user_industry_access (user_id, industry_group) VALUES (v_owner, 'financial-services')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.companies (name, industry, city, state, country, email, phone, created_by, tenant_id, industry_group)
  VALUES
    ('Sundaram Textiles','Manufacturing','Coimbatore','Tamil Nadu','India','cfo@sundaramtex.in','+91 98400 11223', v_owner, v_tenant, 'financial-services'),
    ('Bluewave Logistics','Logistics','Pune','Maharashtra','India','accounts@bluewavelog.in','+91 98220 44556', v_owner, v_tenant, 'financial-services'),
    ('Nova Health Clinics','Healthcare','Hyderabad','Telangana','India','finance@novahealth.in','+91 90000 77889', v_owner, v_tenant, 'financial-services'),
    ('Greenfield Agro','Agriculture','Nashik','Maharashtra','India','owner@greenfieldagro.in','+91 99700 33445', v_owner, v_tenant, 'financial-services')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_c1 FROM public.companies WHERE tenant_id = v_tenant AND name = 'Sundaram Textiles';
  SELECT id INTO v_c2 FROM public.companies WHERE tenant_id = v_tenant AND name = 'Bluewave Logistics';
  SELECT id INTO v_c3 FROM public.companies WHERE tenant_id = v_tenant AND name = 'Nova Health Clinics';
  SELECT id INTO v_c4 FROM public.companies WHERE tenant_id = v_tenant AND name = 'Greenfield Agro';

  INSERT INTO public.contacts (company_id, first_name, last_name, email, phone, designation, created_by, tenant_id, industry_group)
  VALUES
    (v_c1,'Ramesh','Iyer','ramesh@sundaramtex.in','+91 98400 11223','CFO', v_owner, v_tenant,'financial-services'),
    (v_c2,'Anita','Deshpande','anita@bluewavelog.in','+91 98220 44556','Director', v_owner, v_tenant,'financial-services'),
    (v_c3,'Kiran','Rao','kiran@novahealth.in','+91 90000 77889','Managing Partner', v_owner, v_tenant,'financial-services'),
    (v_c4,'Sunil','Patil','sunil@greenfieldagro.in','+91 99700 33445','Proprietor', v_owner, v_tenant,'financial-services'),
    (v_c1,'Meera','Nair','meera@sundaramtex.in','+91 98400 55667','Finance Manager', v_owner, v_tenant,'financial-services')
  ON CONFLICT DO NOTHING;

  FOR v_lead, v_rec IN
    SELECT gen_random_uuid(), gen_random_uuid() FROM generate_series(1,1)
  LOOP END LOOP;

  -- Leads + matching lending pipeline records
  INSERT INTO public.leads (company_id, company_name, contact_person, email, phone, city, state, source, campaign, status, priority, estimated_value, expected_close_date, assigned_to, created_by, tenant_id, industry_group, notes)
  VALUES
    (v_c1,'Sundaram Textiles','Ramesh Iyer','ramesh@sundaramtex.in','+91 98400 11223','Coimbatore','Tamil Nadu','Referral','Working Capital Q3','qualified','high', 12500000, CURRENT_DATE + 21, v_owner, v_owner, v_tenant,'financial-services','Working capital limit enhancement'),
    (v_c2,'Bluewave Logistics','Anita Deshpande','anita@bluewavelog.in','+91 98220 44556','Pune','Maharashtra','Website','Fleet Finance','proposal_sent','high', 8500000, CURRENT_DATE + 14, v_owner, v_owner, v_tenant,'financial-services','Fleet expansion — 12 trucks'),
    (v_c3,'Nova Health Clinics','Kiran Rao','kiran@novahealth.in','+91 90000 77889','Hyderabad','Telangana','Partner','Equipment Loan','contacted','medium', 6200000, CURRENT_DATE + 30, v_owner, v_owner, v_tenant,'financial-services','MRI equipment finance'),
    (v_c4,'Greenfield Agro','Sunil Patil','sunil@greenfieldagro.in','+91 99700 33445','Nashik','Maharashtra','Walk-in','Agri Term Loan','new','medium', 3500000, CURRENT_DATE + 45, v_owner, v_owner, v_tenant,'financial-services','Cold storage expansion'),
    (v_c1,'Sundaram Textiles','Meera Nair','meera@sundaramtex.in','+91 98400 55667','Coimbatore','Tamil Nadu','Referral','LAP Renewals','won','high', 21000000, CURRENT_DATE - 5, v_owner, v_owner, v_tenant,'financial-services','LAP against factory premises');

  INSERT INTO public.pack_records (tenant_id, group_slug, pack_slug, title, stage, contact_name, contact_email, contact_phone, city, value, source, priority, owner_id, assigned_to, created_by, won, lead_id)
  SELECT v_tenant,'financial-services','lending', l.company_name || ' — ' || COALESCE(l.campaign,'Loan'),
         CASE l.status WHEN 'new' THEN 'Lead' WHEN 'contacted' THEN 'Docs Collected' WHEN 'qualified' THEN 'Credit Review' WHEN 'proposal_sent' THEN 'Sanctioned' WHEN 'won' THEN 'Disbursed' ELSE 'Lead' END,
         l.contact_person, l.email, l.phone, l.city, l.estimated_value, l.source, l.priority::text, v_owner, v_owner, v_owner,
         (l.status = 'won'), l.id
  FROM public.leads l WHERE l.tenant_id = v_tenant;

  -- Tenant-specific pack configuration (stages, fields, AI prompts)
  INSERT INTO public.pack_configs (tenant_id, group_slug, pack_slug, name, record_label, record_label_plural, party_label, value_label,
    stages, won_stages, lost_stages, fields, agents, updated_by)
  VALUES (
    v_tenant,'financial-services','lending','Apex Lending','Loan File','Loan Files','Borrower','Loan Amount',
    '["Lead","Docs Collected","Credit Review","Sanctioned","Disbursed","Rejected"]'::jsonb,
    '["Disbursed"]'::jsonb,
    '["Rejected"]'::jsonb,
    '[{"key":"loan_type","label":"Loan Type","type":"select","options":["Working Capital","Term Loan","LAP","Equipment"]},{"key":"cibil","label":"CIBIL Score","type":"number"},{"key":"lender","label":"Preferred Lender","type":"text"}]'::jsonb,
    '[{"key":"credit_summary","name":"Credit Summary Agent","prompt":"Summarise the borrower profile, requested loan amount and key credit risks in 5 bullets, using Apex Finserv underwriting language."},{"key":"next_step","name":"Next Best Action","prompt":"Given the loan file stage and missing documents, recommend the single next action for the relationship manager."}]'::jsonb,
    v_owner
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.proposal_templates (tenant_id, group_slug, pack_slug, name, description, industry, body, default_value, is_shared, created_by)
  VALUES
    (v_tenant,'financial-services','lending','Working Capital Sanction Letter','Standard WC facility offer','financial-services',
      E'Dear {{borrower}},\n\nWe are pleased to offer a working capital facility of {{amount}} at an indicative rate of {{rate}}% p.a., subject to the terms below.\n\n1. Security: hypothecation of stock and book debts\n2. Tenure: 12 months, renewable\n3. Processing fee: 1% of sanctioned limit\n\nRegards,\nApex Finserv', 10000000, true, v_owner),
    (v_tenant,'financial-services','lending','Equipment Finance Proposal','Asset-backed equipment funding','financial-services',
      E'Dear {{borrower}},\n\nProposal for equipment finance of {{amount}} covering up to 80% of invoice value.\n\n1. Margin: 20%\n2. Tenure: up to 60 months\n3. Security: hypothecation of the financed asset\n\nRegards,\nApex Finserv', 6000000, true, v_owner)
  ON CONFLICT DO NOTHING;

  -- A live proposal on the pipeline
  INSERT INTO public.proposals (title, description, lead_id, company_id, stage, value, probability, close_date, owner_id, created_by, tenant_id, industry_group, group_slug, pack_slug, pack_record_id, approval_status)
  SELECT 'Bluewave Logistics — Fleet Finance', 'Term loan for 12 commercial vehicles', l.id, l.company_id, 'sent', 8500000, 60, CURRENT_DATE + 14, v_owner, v_owner, v_tenant, 'financial-services','financial-services','lending', r.id, 'pending'
  FROM public.leads l
  LEFT JOIN public.pack_records r ON r.lead_id = l.id
  WHERE l.tenant_id = v_tenant AND l.company_name = 'Bluewave Logistics'
  LIMIT 1;
END
$seed$;