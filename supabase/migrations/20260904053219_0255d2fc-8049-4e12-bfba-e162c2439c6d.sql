-- 1. Pack CMS overrides
CREATE TABLE public.pack_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_slug text NOT NULL,
  pack_slug text NOT NULL,
  record_label text,
  record_label_plural text,
  party_label text,
  value_label text,
  stages jsonb,
  won_stages jsonb,
  fields jsonb,
  agents jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_slug, pack_slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_configs TO authenticated;
GRANT ALL ON public.pack_configs TO service_role;
ALTER TABLE public.pack_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pack_configs_select" ON public.pack_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "pack_configs_insert" ON public.pack_configs FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "pack_configs_update" ON public.pack_configs FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "pack_configs_delete" ON public.pack_configs FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role));
CREATE TRIGGER pack_configs_updated_at BEFORE UPDATE ON public.pack_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER pack_configs_audit AFTER INSERT OR UPDATE OR DELETE ON public.pack_configs
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- 2. Portal documents
CREATE TABLE public.pack_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.pack_records(id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pack_documents_record ON public.pack_documents(record_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_documents TO authenticated;
GRANT ALL ON public.pack_documents TO service_role;
ALTER TABLE public.pack_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pack_documents_select" ON public.pack_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id));
CREATE POLICY "pack_documents_insert" ON public.pack_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id));
CREATE POLICY "pack_documents_update" ON public.pack_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id));
CREATE POLICY "pack_documents_delete" ON public.pack_documents FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'sales_manager'::app_role));
CREATE TRIGGER pack_documents_updated_at BEFORE UPDATE ON public.pack_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Portal payments
CREATE TABLE public.pack_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.pack_records(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'invoice',
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'due',
  due_date date,
  paid_at timestamptz,
  reference text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pack_payments_record ON public.pack_payments(record_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pack_payments TO authenticated;
GRANT ALL ON public.pack_payments TO service_role;
ALTER TABLE public.pack_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pack_payments_select" ON public.pack_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id));
CREATE POLICY "pack_payments_insert" ON public.pack_payments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id));
CREATE POLICY "pack_payments_update" ON public.pack_payments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pack_records r WHERE r.id = record_id));
CREATE POLICY "pack_payments_delete" ON public.pack_payments FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role) OR private.has_role(auth.uid(),'sales_manager'::app_role));
CREATE TRIGGER pack_payments_updated_at BEFORE UPDATE ON public.pack_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Affiliate settings
CREATE TABLE public.affiliate_settings (
  id text PRIMARY KEY DEFAULT 'default',
  default_commission_pct numeric NOT NULL DEFAULT 20,
  cookie_days integer NOT NULL DEFAULT 60,
  payout_terms text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.affiliate_settings TO authenticated;
GRANT SELECT ON public.affiliate_settings TO anon;
GRANT ALL ON public.affiliate_settings TO service_role;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_settings_read" ON public.affiliate_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "affiliate_settings_insert" ON public.affiliate_settings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "affiliate_settings_update" ON public.affiliate_settings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(),'super_admin'::app_role) OR private.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER affiliate_settings_updated_at BEFORE UPDATE ON public.affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.affiliate_settings (id, default_commission_pct, cookie_days, payout_terms)
VALUES ('default', 20, 60, 'Commission is payable 30 days after the referred customer pays their first invoice.');

-- 5. Auto-create an affiliate commission when a referred lead is won
CREATE OR REPLACE FUNCTION public.affiliate_commission_on_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct numeric;
  v_base numeric;
BEGIN
  IF NEW.affiliate_id IS NOT NULL
     AND NEW.status = 'won'::lead_status
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT commission_pct INTO v_pct FROM public.affiliates WHERE id = NEW.affiliate_id;
    v_base := COALESCE(NEW.estimated_value, 0);
    IF v_pct IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.affiliate_commissions WHERE lead_id = NEW.id
    ) THEN
      INSERT INTO public.affiliate_commissions
        (affiliate_id, lead_id, base_amount, commission_pct, commission_amount, status, notes)
      VALUES (NEW.affiliate_id, NEW.id, v_base, v_pct,
              ROUND(v_base * v_pct / 100.0, 2), 'pending',
              'Auto-generated when the referred lead was won');
      NEW.converted_at := COALESCE(NEW.converted_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.affiliate_commission_on_won() FROM public, anon, authenticated;
CREATE TRIGGER leads_affiliate_commission BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_commission_on_won();