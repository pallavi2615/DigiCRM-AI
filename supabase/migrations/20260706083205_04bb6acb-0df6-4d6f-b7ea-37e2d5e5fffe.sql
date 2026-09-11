
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'sales_manager', 'sales_executive');
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost');
CREATE TYPE public.lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  designation TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES (separate for security) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin'))
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin','sales_manager'))
$$;

-- ============ AUTO-CREATE PROFILE + ROLE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- First user becomes super_admin, everyone else sales_executive by default
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'super_admin'::app_role ELSE 'sales_executive'::app_role END);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  employee_count INT,
  annual_revenue NUMERIC,
  gst_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_companies_name ON public.companies(name);
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CONTACTS ============
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  designation TEXT,
  avatar_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  designation TEXT,
  email TEXT,
  phone TEXT,
  alternate_phone TEXT,
  website TEXT,
  industry TEXT,
  country TEXT,
  state TEXT,
  city TEXT,
  address TEXT,
  source TEXT,
  campaign TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  priority lead_priority NOT NULL DEFAULT 'medium',
  estimated_value NUMERIC DEFAULT 0,
  expected_close_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due ON public.tasks(due_date);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MEETINGS ============
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_url TEXT,
  status meeting_status NOT NULL DEFAULT 'scheduled',
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organizer UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  participants UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meetings_starts ON public.meetings(starts_at);
CREATE TRIGGER trg_meetings_updated BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACTIVITIES (audit / timeline) ============
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activities_entity ON public.activities(entity_type, entity_id);
CREATE INDEX idx_activities_created ON public.activities(created_at DESC);

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);

-- ============ RLS POLICIES ============

-- profiles: everyone signed in can read (for assignment dropdowns), user updates own
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles: users see own roles; admins see all
CREATE POLICY "roles view own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- companies: all authenticated can read; managers+ can write
CREATE POLICY "companies read" ON public.companies FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "companies insert" ON public.companies FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "companies update" ON public.companies FOR UPDATE TO authenticated USING (public.is_manager_or_above(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "companies delete admin" ON public.companies FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- contacts
CREATE POLICY "contacts read" ON public.contacts FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "contacts insert" ON public.contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "contacts update" ON public.contacts FOR UPDATE TO authenticated USING (public.is_manager_or_above(auth.uid()) OR created_by = auth.uid());
CREATE POLICY "contacts delete admin" ON public.contacts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- leads: executives see only assigned; managers+ see all
CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- tasks: user sees own + assigned; managers+ see all
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- meetings: organizer or participant; managers+ see all
CREATE POLICY "meetings read" ON public.meetings FOR SELECT TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR organizer = auth.uid() OR auth.uid() = ANY(participants));
CREATE POLICY "meetings insert" ON public.meetings FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer);
CREATE POLICY "meetings update" ON public.meetings FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()) OR organizer = auth.uid());
CREATE POLICY "meetings delete" ON public.meetings FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR organizer = auth.uid());

-- activities: read all (audit trail); insert by anyone signed in
CREATE POLICY "activities read" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "activities insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- notifications: only own
CREATE POLICY "notifications own" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
