
-- Backfill industry_group on leads from the free-text industry column
UPDATE public.leads SET industry_group = CASE
  WHEN lower(coalesce(industry,'')) IN ('healthcare','clinic','clinics','hospital','pharma') THEN 'healthcare'
  WHEN lower(coalesce(industry,'')) IN ('education','edtech','university','school') THEN 'education'
  WHEN lower(coalesce(industry,'')) IN ('retail','ecommerce','e-commerce','commerce','d2c') THEN 'commerce'
  WHEN lower(coalesce(industry,'')) IN ('saas','it','software','technology','consulting') THEN 'professional-services'
  WHEN lower(coalesce(industry,'')) IN ('robotics','manufacturing','industrial','engineering') THEN 'industrial'
  WHEN lower(coalesce(industry,'')) IN ('logistics','transport','automotive','travel','mobility') THEN 'mobility-supply-chain'
  WHEN lower(coalesce(industry,'')) IN ('fintech','banking','nbfc','lending','insurance','financial services') THEN 'financial-services'
  WHEN lower(coalesce(industry,'')) IN ('real estate','property','realty') THEN 'property'
  ELSE industry_group END
WHERE industry_group IS NULL;

-- Tenants that declare an industry pass it to their own untagged records
UPDATE public.leads l SET industry_group = t.industry
FROM public.tenants t WHERE l.tenant_id = t.id AND l.industry_group IS NULL AND t.industry IS NOT NULL;

-- Companies inherit from the leads that reference them
UPDATE public.companies c SET industry_group = sub.g
FROM (SELECT company_id, min(industry_group) g FROM public.leads
      WHERE company_id IS NOT NULL AND industry_group IS NOT NULL GROUP BY company_id) sub
WHERE c.id = sub.company_id AND c.industry_group IS NULL;

UPDATE public.contacts ct SET industry_group = c.industry_group
FROM public.companies c WHERE ct.company_id = c.id AND ct.industry_group IS NULL AND c.industry_group IS NOT NULL;

UPDATE public.contacts ct SET industry_group = l.industry_group
FROM public.leads l WHERE l.contact_id = ct.id AND ct.industry_group IS NULL AND l.industry_group IS NOT NULL;

-- Activity records inherit from the lead they hang off
UPDATE public.tasks tk SET industry_group = l.industry_group
FROM public.leads l WHERE tk.lead_id = l.id AND tk.industry_group IS NULL AND l.industry_group IS NOT NULL;

UPDATE public.meetings m SET industry_group = l.industry_group
FROM public.leads l WHERE m.lead_id = l.id AND m.industry_group IS NULL AND l.industry_group IS NOT NULL;

UPDATE public.proposals p SET industry_group = l.industry_group
FROM public.leads l WHERE p.lead_id = l.id AND p.industry_group IS NULL AND l.industry_group IS NOT NULL;

UPDATE public.proposals p SET industry_group = c.industry_group
FROM public.companies c WHERE p.company_id = c.id AND p.industry_group IS NULL AND c.industry_group IS NOT NULL;

UPDATE public.support_tickets s SET industry_group = t.industry
FROM public.tenants t WHERE s.tenant_id = t.id AND s.industry_group IS NULL AND t.industry IS NOT NULL;
