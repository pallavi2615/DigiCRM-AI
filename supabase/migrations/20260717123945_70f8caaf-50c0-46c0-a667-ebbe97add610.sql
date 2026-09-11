
-- Fintech DSA CRM tables

CREATE TYPE public.loan_type AS ENUM ('personal','home','business','lap','auto','education','gold');
CREATE TYPE public.loan_stage AS ENUM ('new','docs_pending','docs_collected','login','under_review','sanctioned','disbursed','rejected','on_hold');
CREATE TYPE public.employment_type AS ENUM ('salaried','self_employed','business','professional','retired','other');
CREATE TYPE public.doc_type AS ENUM ('pan','aadhaar','bank_stmt','itr','salary_slip','form16','photo','address_proof','property_papers','other');
CREATE TYPE public.doc_status AS ENUM ('pending','uploaded','verified','rejected');
CREATE TYPE public.commission_status AS ENUM ('pending','invoiced','received','cancelled');

-- Lenders
CREATE TABLE public.lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lender_type TEXT NOT NULL DEFAULT 'bank',
  logo_url TEXT,
  roi_min NUMERIC(5,2),
  roi_max NUMERIC(5,2),
  processing_fee_pct NUMERIC(5,2),
  payout_pct NUMERIC(5,2) DEFAULT 1.00,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lenders TO authenticated;
GRANT ALL ON public.lenders TO service_role;
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lenders read all authenticated" ON public.lenders FOR SELECT TO authenticated USING (true);
CREATE POLICY "lenders admin write" ON public.lenders FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "lenders admin update" ON public.lenders FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "lenders admin delete" ON public.lenders FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_lenders_updated BEFORE UPDATE ON public.lenders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lenders_audit AFTER INSERT OR UPDATE OR DELETE ON public.lenders FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Loan Products
CREATE TABLE public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES public.lenders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_type public.loan_type NOT NULL,
  min_amount NUMERIC(14,2),
  max_amount NUMERIC(14,2),
  min_tenure_months INT,
  max_tenure_months INT,
  roi_min NUMERIC(5,2),
  roi_max NUMERIC(5,2),
  processing_fee_pct NUMERIC(5,2),
  payout_pct NUMERIC(5,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_products TO authenticated;
GRANT ALL ON public.loan_products TO service_role;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_products read all" ON public.loan_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_products admin write" ON public.loan_products FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE TRIGGER trg_loan_products_updated BEFORE UPDATE ON public.loan_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loan_products_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_products FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Loan Applications
CREATE TABLE public.loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  pan TEXT,
  date_of_birth DATE,
  employment_type public.employment_type,
  employer_name TEXT,
  monthly_income NUMERIC(14,2),
  existing_emi NUMERIC(14,2),
  city TEXT,
  loan_type public.loan_type NOT NULL,
  requested_amount NUMERIC(14,2) NOT NULL,
  tenure_months INT,
  purpose TEXT,
  lender_id UUID REFERENCES public.lenders(id),
  loan_product_id UUID REFERENCES public.loan_products(id),
  stage public.loan_stage NOT NULL DEFAULT 'new',
  sanctioned_amount NUMERIC(14,2),
  disbursed_amount NUMERIC(14,2),
  roi NUMERIC(5,2),
  emi NUMERIC(14,2),
  disbursed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  source TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loan_apps_stage ON public.loan_applications(stage);
CREATE INDEX idx_loan_apps_assigned ON public.loan_applications(assigned_to);
CREATE INDEX idx_loan_apps_created_by ON public.loan_applications(created_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_applications TO authenticated;
GRANT ALL ON public.loan_applications TO service_role;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_apps select scoped" ON public.loan_applications FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager')
    OR created_by = auth.uid() OR assigned_to = auth.uid()
  );
CREATE POLICY "loan_apps insert own" ON public.loan_applications FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
CREATE POLICY "loan_apps update scoped" ON public.loan_applications FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager')
    OR created_by = auth.uid() OR assigned_to = auth.uid()
  );
CREATE POLICY "loan_apps delete admin" ON public.loan_applications FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_loan_apps_updated BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loan_apps_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Loan Documents
CREATE TABLE public.loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  doc_type public.doc_type NOT NULL,
  status public.doc_status NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  file_name TEXT,
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loan_docs_app ON public.loan_documents(application_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_documents TO authenticated;
GRANT ALL ON public.loan_documents TO service_role;
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loan_docs scoped" ON public.loan_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.loan_applications la WHERE la.id = application_id
    AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager')
      OR la.created_by = auth.uid() OR la.assigned_to = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.loan_applications la WHERE la.id = application_id
    AND (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager')
      OR la.created_by = auth.uid() OR la.assigned_to = auth.uid())));
CREATE TRIGGER trg_loan_docs_updated BEFORE UPDATE ON public.loan_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loan_docs_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_documents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Loan Commissions
CREATE TABLE public.loan_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES auth.users(id),
  lender_id UUID REFERENCES public.lenders(id),
  disbursed_amount NUMERIC(14,2) NOT NULL,
  payout_pct NUMERIC(5,2) NOT NULL,
  expected_amount NUMERIC(14,2) NOT NULL,
  received_amount NUMERIC(14,2) DEFAULT 0,
  received_at TIMESTAMPTZ,
  invoice_no TEXT,
  status public.commission_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commissions_app ON public.loan_commissions(application_id);
CREATE INDEX idx_commissions_agent ON public.loan_commissions(agent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_commissions TO authenticated;
GRANT ALL ON public.loan_commissions TO service_role;
ALTER TABLE public.loan_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions select scoped" ON public.loan_commissions FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager')
    OR agent_id = auth.uid()
  );
CREATE POLICY "commissions admin write" ON public.loan_commissions FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "commissions admin update" ON public.loan_commissions FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "commissions admin delete" ON public.loan_commissions FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_commissions_updated BEFORE UPDATE ON public.loan_commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_commissions_audit AFTER INSERT OR UPDATE OR DELETE ON public.loan_commissions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Auto-create commission row on disbursal
CREATE OR REPLACE FUNCTION public.on_loan_disbursed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payout NUMERIC(5,2); v_expected NUMERIC(14,2);
BEGIN
  IF NEW.stage = 'disbursed' AND (OLD.stage IS DISTINCT FROM 'disbursed') AND NEW.disbursed_amount IS NOT NULL THEN
    SELECT COALESCE(lp.payout_pct, l.payout_pct, 1.0) INTO v_payout
      FROM public.lenders l LEFT JOIN public.loan_products lp ON lp.id = NEW.loan_product_id
      WHERE l.id = NEW.lender_id;
    v_expected := NEW.disbursed_amount * COALESCE(v_payout, 1.0) / 100.0;
    INSERT INTO public.loan_commissions(application_id, agent_id, lender_id, disbursed_amount, payout_pct, expected_amount)
    VALUES (NEW.id, COALESCE(NEW.assigned_to, NEW.created_by), NEW.lender_id, NEW.disbursed_amount, COALESCE(v_payout, 1.0), v_expected);
    IF NEW.disbursed_at IS NULL THEN NEW.disbursed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_loan_disbursed BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.on_loan_disbursed();

-- Seed lenders
INSERT INTO public.lenders (name, lender_type, roi_min, roi_max, processing_fee_pct, payout_pct) VALUES
  ('HDFC Bank','bank',8.50,14.00,1.00,1.20),
  ('ICICI Bank','bank',8.75,14.50,1.00,1.10),
  ('Axis Bank','bank',9.00,15.00,1.25,1.15),
  ('Bajaj Finserv','nbfc',10.50,18.00,1.50,1.75),
  ('Tata Capital','nbfc',10.00,17.00,1.25,1.50),
  ('IIFL Finance','nbfc',11.00,20.00,1.50,2.00),
  ('Fullerton India','nbfc',11.50,22.00,1.75,2.25),
  ('Aditya Birla Capital','nbfc',10.75,18.50,1.50,1.80);

-- Seed sample products
INSERT INTO public.loan_products (lender_id, name, product_type, min_amount, max_amount, min_tenure_months, max_tenure_months, roi_min, roi_max, processing_fee_pct, payout_pct)
SELECT id, name || ' Personal Loan', 'personal', 50000, 4000000, 12, 60, roi_min, roi_max, processing_fee_pct, payout_pct FROM public.lenders WHERE lender_type='bank';
INSERT INTO public.loan_products (lender_id, name, product_type, min_amount, max_amount, min_tenure_months, max_tenure_months, roi_min, roi_max, processing_fee_pct, payout_pct)
SELECT id, name || ' Home Loan', 'home', 500000, 100000000, 60, 360, roi_min - 1.0, roi_max - 1.0, 0.50, payout_pct FROM public.lenders WHERE lender_type='bank';
INSERT INTO public.loan_products (lender_id, name, product_type, min_amount, max_amount, min_tenure_months, max_tenure_months, roi_min, roi_max, processing_fee_pct, payout_pct)
SELECT id, name || ' Business Loan', 'business', 100000, 50000000, 12, 84, roi_min + 1.0, roi_max + 1.0, 1.50, payout_pct FROM public.lenders;
