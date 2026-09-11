
-- ============================================
-- DigiCRM AI — CMS, Blog, Affiliate, Campaigns
-- ============================================

-- ---- CMS Pages (marketing pages managed by super admin) ----
CREATE TABLE public.cms_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_description TEXT,
  seo_keywords TEXT,
  og_image TEXT,
  canonical_override TEXT,
  noindex BOOLEAN NOT NULL DEFAULT false,
  hero JSONB NOT NULL DEFAULT '{}'::jsonb,
  body JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_pages TO authenticated;
GRANT ALL ON public.cms_pages TO service_role;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_pages public read published" ON public.cms_pages FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "cms_pages super_admin all" ON public.cms_pages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER cms_pages_updated_at BEFORE UPDATE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cms_pages_audit AFTER INSERT OR UPDATE OR DELETE ON public.cms_pages FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---- Blog Posts ----
CREATE TABLE public.cms_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  body TEXT NOT NULL DEFAULT '',
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  reading_minutes INT NOT NULL DEFAULT 3,
  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_posts TO authenticated;
GRANT ALL ON public.cms_posts TO service_role;
ALTER TABLE public.cms_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_posts public read published" ON public.cms_posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "cms_posts super_admin all" ON public.cms_posts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));
CREATE INDEX cms_posts_published_at_idx ON public.cms_posts (published_at DESC);
CREATE INDEX cms_posts_tags_idx ON public.cms_posts USING gin (tags);
CREATE TRIGGER cms_posts_updated_at BEFORE UPDATE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cms_posts_audit AFTER INSERT OR UPDATE OR DELETE ON public.cms_posts FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---- Home Hero Slides ----
CREATE TABLE public.cms_home_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  headline TEXT NOT NULL,
  subhead TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_home_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_home_slides TO authenticated;
GRANT ALL ON public.cms_home_slides TO service_role;
ALTER TABLE public.cms_home_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_home_slides public read active" ON public.cms_home_slides FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "cms_home_slides super_admin all" ON public.cms_home_slides FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER cms_home_slides_updated_at BEFORE UPDATE ON public.cms_home_slides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Global SEO Settings (singleton row keyed by id='global') ----
CREATE TABLE public.cms_seo_settings (
  id TEXT NOT NULL PRIMARY KEY,
  site_name TEXT NOT NULL DEFAULT 'DigiCRM AI',
  default_title TEXT NOT NULL DEFAULT 'DigiCRM AI — The AI-native CRM',
  default_description TEXT NOT NULL DEFAULT 'Multi-tenant AI-powered sales CRM.',
  default_og_image TEXT,
  twitter_handle TEXT,
  ga_id TEXT,
  gtm_id TEXT,
  meta_pixel_id TEXT,
  robots_default TEXT NOT NULL DEFAULT 'index,follow',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_seo_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_seo_settings TO authenticated;
GRANT ALL ON public.cms_seo_settings TO service_role;
ALTER TABLE public.cms_seo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_seo public read" ON public.cms_seo_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cms_seo super_admin write" ON public.cms_seo_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER cms_seo_settings_updated_at BEFORE UPDATE ON public.cms_seo_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.cms_seo_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- ---- Header/Footer Menu Items ----
CREATE TABLE public.cms_menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location TEXT NOT NULL CHECK (location IN ('header','footer')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  group_label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_menu_items TO authenticated;
GRANT ALL ON public.cms_menu_items TO service_role;
ALTER TABLE public.cms_menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_menu public read" ON public.cms_menu_items FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "cms_menu super_admin write" ON public.cms_menu_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER cms_menu_items_updated_at BEFORE UPDATE ON public.cms_menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Campaign Landing Pages ----
CREATE TABLE public.cms_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  subhead TEXT,
  hero_image TEXT,
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label TEXT NOT NULL DEFAULT 'Get started',
  form_fields JSONB NOT NULL DEFAULT '["name","email","company","phone"]'::jsonb,
  thank_you_message TEXT NOT NULL DEFAULT 'Thanks — we will be in touch shortly.',
  theme TEXT NOT NULL DEFAULT 'default',
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_campaigns TO authenticated;
GRANT ALL ON public.cms_campaigns TO service_role;
ALTER TABLE public.cms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_campaigns public read active" ON public.cms_campaigns FOR SELECT TO anon, authenticated USING (
  active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);
CREATE POLICY "cms_campaigns super_admin all" ON public.cms_campaigns FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin')) WITH CHECK (private.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER cms_campaigns_updated_at BEFORE UPDATE ON public.cms_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Contact form submissions ----
CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'contact',
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT SELECT, UPDATE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact_submissions public insert" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "contact_submissions admin read" ON public.contact_submissions FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin') OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "contact_submissions admin update" ON public.contact_submissions FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin') OR private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER contact_submissions_updated_at BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Affiliates ----
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  audience TEXT,
  channels TEXT,
  payout_method TEXT,
  referral_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.affiliates TO anon, authenticated;
GRANT SELECT, UPDATE ON public.affiliates TO authenticated;
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliates public insert" ON public.affiliates FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "affiliates admin read" ON public.affiliates FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'super_admin')
    OR private.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
  );
CREATE POLICY "affiliates admin update" ON public.affiliates FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'super_admin') OR private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER affiliates_updated_at BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Seed content so pages have data on first load ----
INSERT INTO public.cms_home_slides (headline, subhead, cta_label, cta_url, sort_order, active) VALUES
  ('The CRM that thinks with your team', 'AI-native pipeline, proposals & automation — one workspace.', 'Start free trial', '/auth', 1, true),
  ('Close deals 2x faster with AI', 'Draft outreach, proposals and next-best actions in seconds.', 'See how it works', '/features', 2, true),
  ('Industry-tuned for Fintech, Real Estate, IT & Product Sales', 'Prebuilt pipelines, KYC, commissions and dashboards.', 'Explore industries', '/industries', 3, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.cms_menu_items (location, label, url, sort_order) VALUES
  ('header','Features','/features',1),
  ('header','Industries','/industries',2),
  ('header','Pricing','/pricing',3),
  ('header','Blog','/blog',4),
  ('header','Affiliate','/affiliate',5),
  ('header','About','/about',6),
  ('header','Contact','/contact',7),
  ('footer','Features','/features',1),
  ('footer','Pricing','/pricing',2),
  ('footer','Blog','/blog',3),
  ('footer','About','/about',4),
  ('footer','Contact','/contact',5),
  ('footer','Affiliate Program','/affiliate',6),
  ('footer','Privacy','/legal/privacy',7),
  ('footer','Terms','/legal/terms',8)
ON CONFLICT DO NOTHING;

INSERT INTO public.cms_posts (slug, title, excerpt, body, author_name, tags, reading_minutes, status, published_at) VALUES
  ('welcome-to-digicrm-ai','Welcome to DigiCRM AI','Meet the AI-native CRM built for modern revenue teams.',
   E'# Welcome to DigiCRM AI\n\nDigiCRM AI unifies pipeline, proposals, automation, and audit-grade governance in one workspace. This is our first post — stay tuned for product deep-dives, playbooks and customer stories.',
   'DigiCRM Team', ARRAY['product','announcements'], 3, 'published', now()),
  ('ai-proposals-in-60-seconds','AI proposals in 60 seconds','How the AI proposal generator drafts client-ready docs from your deal context.',
   E'# AI proposals in 60 seconds\n\nStop context-switching between docs, decks and CRM. Ask DigiCRM AI to write a proposal — grounded in the deal you selected — and export in one click.',
   'DigiCRM Team', ARRAY['ai','sales'], 4, 'published', now()),
  ('rbac-that-actually-works','RBAC that actually works','Row-level security, four roles, and end-to-end tests keeping data honest.',
   E'# RBAC that actually works\n\nEvery table is RLS-first with policies scoped to the caller. Sales Executives never see rows they do not own, and every denied attempt is captured in the audit log.',
   'DigiCRM Team', ARRAY['security','engineering'], 5, 'published', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.cms_campaigns (slug, headline, subhead, cta_label, benefits, active) VALUES
  ('launch','Get 30% off DigiCRM AI — launch offer','Migrate in a day. Save all year. AI proposals + automation included.',
   'Claim my discount',
   '["30% off for 12 months","White-glove CSV migration","Priority onboarding","AI proposals unlimited"]'::jsonb,
   true)
ON CONFLICT DO NOTHING;
