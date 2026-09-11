
-- Product Sales industry module
CREATE TABLE public.ps_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price NUMERIC(14,2) NOT NULL DEFAULT 0,
  cost NUMERIC(14,2) DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  commission_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_products TO authenticated;
GRANT ALL ON public.ps_products TO service_role;
ALTER TABLE public.ps_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_products read" ON public.ps_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "ps_products insert" ON public.ps_products FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "ps_products update" ON public.ps_products FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "ps_products delete" ON public.ps_products FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin'));

CREATE TABLE public.ps_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no TEXT NOT NULL UNIQUE DEFAULT ('ORD-' || upper(substr(gen_random_uuid()::text,1,8))),
  kind TEXT NOT NULL DEFAULT 'order', -- 'quote' | 'order'
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, confirmed, fulfilled, cancelled
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_orders TO authenticated;
GRANT ALL ON public.ps_orders TO service_role;
ALTER TABLE public.ps_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_orders read" ON public.ps_orders FOR SELECT TO authenticated USING (
  private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager')
  OR owner_id = auth.uid() OR assigned_to = auth.uid()
);
CREATE POLICY "ps_orders insert" ON public.ps_orders FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager'));
CREATE POLICY "ps_orders update" ON public.ps_orders FOR UPDATE TO authenticated USING (
  private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager')
  OR owner_id = auth.uid() OR assigned_to = auth.uid()
);
CREATE POLICY "ps_orders delete" ON public.ps_orders FOR DELETE TO authenticated USING (
  private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin')
);

CREATE TABLE public.ps_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.ps_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.ps_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_order_items TO authenticated;
GRANT ALL ON public.ps_order_items TO service_role;
ALTER TABLE public.ps_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_items rw" ON public.ps_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ps_orders o WHERE o.id = order_id AND (
    private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager')
    OR o.owner_id = auth.uid() OR o.assigned_to = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ps_orders o WHERE o.id = order_id AND (
    private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager')
    OR o.owner_id = auth.uid() OR o.assigned_to = auth.uid())));

CREATE TABLE public.ps_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.ps_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission_pct NUMERIC(6,3) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, paid
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_commissions TO authenticated;
GRANT ALL ON public.ps_commissions TO service_role;
ALTER TABLE public.ps_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_comm read" ON public.ps_commissions FOR SELECT TO authenticated USING (
  private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager')
  OR user_id = auth.uid()
);
CREATE POLICY "ps_comm write" ON public.ps_commissions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager'))
  WITH CHECK (private.has_role(auth.uid(),'super_admin') OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'sales_manager'));

-- triggers
CREATE TRIGGER ps_products_touch BEFORE UPDATE ON public.ps_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ps_orders_touch BEFORE UPDATE ON public.ps_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ps_comm_touch BEFORE UPDATE ON public.ps_commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ps_products_audit AFTER INSERT OR UPDATE OR DELETE ON public.ps_products FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER ps_orders_audit AFTER INSERT OR UPDATE OR DELETE ON public.ps_orders FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER ps_items_audit AFTER INSERT OR UPDATE OR DELETE ON public.ps_order_items FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER ps_comm_audit AFTER INSERT OR UPDATE OR DELETE ON public.ps_commissions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Auto commission calc on order confirm
CREATE OR REPLACE FUNCTION public.ps_calc_commissions() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_beneficiary UUID;
  v_pct NUMERIC := 5.0; -- default fallback percentage
  v_amount NUMERIC;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    v_beneficiary := COALESCE(NEW.assigned_to, NEW.owner_id);
    IF v_beneficiary IS NOT NULL THEN
      v_amount := ROUND(NEW.total * v_pct / 100.0, 2);
      INSERT INTO public.ps_commissions(order_id, user_id, base_amount, commission_pct, commission_amount, status)
      VALUES (NEW.id, v_beneficiary, NEW.total, v_pct, v_amount, 'pending')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER ps_orders_commission AFTER UPDATE ON public.ps_orders FOR EACH ROW EXECUTE FUNCTION public.ps_calc_commissions();
