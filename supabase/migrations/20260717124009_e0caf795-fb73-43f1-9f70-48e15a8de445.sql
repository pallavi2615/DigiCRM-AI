
DROP TRIGGER IF EXISTS trg_loan_disbursed ON public.loan_applications;
DROP FUNCTION IF EXISTS public.on_loan_disbursed();

CREATE OR REPLACE FUNCTION private.on_loan_disbursed()
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

CREATE TRIGGER trg_loan_disbursed BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION private.on_loan_disbursed();
