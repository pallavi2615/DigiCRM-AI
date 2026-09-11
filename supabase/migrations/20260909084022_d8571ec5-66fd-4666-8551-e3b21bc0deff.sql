
ALTER TABLE public.affiliate_payout_requests
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.affiliate_payout_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    ELSIF NEW.status = 'paid' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      NEW.paid_at := COALESCE(NEW.paid_at, now());
    END IF;
    NEW.processed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_payout_stamp ON public.affiliate_payout_requests;
CREATE TRIGGER trg_affiliate_payout_stamp
BEFORE UPDATE ON public.affiliate_payout_requests
FOR EACH ROW EXECUTE FUNCTION public.affiliate_payout_stamp();
