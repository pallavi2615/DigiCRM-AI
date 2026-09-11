
-- REAL ESTATE
CREATE TABLE public.re_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, property_type TEXT, city TEXT, address TEXT,
  price NUMERIC, bedrooms INT, bathrooms INT, area_sqft NUMERIC,
  status TEXT DEFAULT 'available', description TEXT, images JSONB DEFAULT '[]'::jsonb,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_properties TO authenticated;
GRANT ALL ON public.re_properties TO service_role;
ALTER TABLE public.re_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "re_props_read" ON public.re_properties FOR SELECT TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "re_props_ins" ON public.re_properties FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()));
CREATE POLICY "re_props_upd" ON public.re_properties FOR UPDATE TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "re_props_del" ON public.re_properties FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

CREATE TABLE public.re_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL, phone TEXT, email TEXT,
  budget_min NUMERIC, budget_max NUMERIC, preferred_city TEXT, preferred_type TEXT, requirement TEXT,
  kyc_status TEXT DEFAULT 'pending', kyc_documents JSONB DEFAULT '[]'::jsonb,
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_clients TO authenticated;
GRANT ALL ON public.re_clients TO service_role;
ALTER TABLE public.re_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "re_cli_read" ON public.re_clients FOR SELECT TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR agent_id = auth.uid());
CREATE POLICY "re_cli_ins" ON public.re_clients FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()));
CREATE POLICY "re_cli_upd" ON public.re_clients FOR UPDATE TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR agent_id = auth.uid());
CREATE POLICY "re_cli_del" ON public.re_clients FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

CREATE TABLE public.re_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.re_clients(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.re_properties(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'inquiry',
  expected_value NUMERIC, final_value NUMERIC,
  agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT, next_action_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_deals TO authenticated;
GRANT ALL ON public.re_deals TO service_role;
ALTER TABLE public.re_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "re_deal_read" ON public.re_deals FOR SELECT TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR agent_id = auth.uid());
CREATE POLICY "re_deal_ins" ON public.re_deals FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()));
CREATE POLICY "re_deal_upd" ON public.re_deals FOR UPDATE TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR agent_id = auth.uid());
CREATE POLICY "re_deal_del" ON public.re_deals FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

CREATE TRIGGER re_props_touch BEFORE UPDATE ON public.re_properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER re_cli_touch BEFORE UPDATE ON public.re_clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER re_deal_touch BEFORE UPDATE ON public.re_deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER re_props_audit AFTER INSERT OR UPDATE OR DELETE ON public.re_properties FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER re_cli_audit AFTER INSERT OR UPDATE OR DELETE ON public.re_clients FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER re_deal_audit AFTER INSERT OR UPDATE OR DELETE ON public.re_deals FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- IT COMPANY
CREATE TABLE public.it_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, client_name TEXT, client_email TEXT,
  description TEXT, tech_stack TEXT,
  stage TEXT NOT NULL DEFAULT 'discovery',
  budget NUMERIC, value NUMERIC,
  start_date DATE, end_date DATE,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_projects TO authenticated;
GRANT ALL ON public.it_projects TO service_role;
ALTER TABLE public.it_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "it_proj_read" ON public.it_projects FOR SELECT TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR manager_id = auth.uid());
CREATE POLICY "it_proj_ins" ON public.it_projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()));
CREATE POLICY "it_proj_upd" ON public.it_projects FOR UPDATE TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR manager_id = auth.uid());
CREATE POLICY "it_proj_del" ON public.it_projects FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

CREATE TABLE public.it_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.it_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  priority TEXT DEFAULT 'medium', status TEXT DEFAULT 'open', ticket_type TEXT DEFAULT 'task',
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_tickets TO authenticated;
GRANT ALL ON public.it_tickets TO service_role;
ALTER TABLE public.it_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "it_tick_read" ON public.it_tickets FOR SELECT TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR assignee_id = auth.uid());
CREATE POLICY "it_tick_ins" ON public.it_tickets FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR private.is_manager_or_above(auth.uid()));
CREATE POLICY "it_tick_upd" ON public.it_tickets FOR UPDATE TO authenticated USING (private.is_manager_or_above(auth.uid()) OR owner_id = auth.uid() OR assignee_id = auth.uid());
CREATE POLICY "it_tick_del" ON public.it_tickets FOR DELETE TO authenticated USING (private.is_admin(auth.uid()) OR owner_id = auth.uid());

CREATE TRIGGER it_proj_touch BEFORE UPDATE ON public.it_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER it_tick_touch BEFORE UPDATE ON public.it_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER it_proj_audit AFTER INSERT OR UPDATE OR DELETE ON public.it_projects FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER it_tick_audit AFTER INSERT OR UPDATE OR DELETE ON public.it_tickets FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
