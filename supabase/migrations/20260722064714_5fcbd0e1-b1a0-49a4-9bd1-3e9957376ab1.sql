
DROP POLICY IF EXISTS "lenders read all authenticated" ON public.lenders;
CREATE POLICY "lenders read staff" ON public.lenders FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR private.has_role(auth.uid(), 'sales_executive'::app_role)
);

DROP POLICY IF EXISTS "loan_products read all" ON public.loan_products;
CREATE POLICY "loan_products read staff" ON public.loan_products FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR private.has_role(auth.uid(), 'sales_executive'::app_role)
);

DROP POLICY IF EXISTS "ps_products read" ON public.ps_products;
CREATE POLICY "ps_products read staff" ON public.ps_products FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'super_admin'::app_role)
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'sales_manager'::app_role)
  OR private.has_role(auth.uid(), 'sales_executive'::app_role)
);
