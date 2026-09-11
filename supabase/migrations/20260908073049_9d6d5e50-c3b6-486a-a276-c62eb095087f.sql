CREATE OR REPLACE FUNCTION public.proposals_guard_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL
     AND NEW.lead_id IS DISTINCT FROM OLD.lead_id
     AND COALESCE(NEW.approval_status, 'not_requested') <> 'approved' THEN
    RAISE EXCEPTION 'This proposal must be approved before it can move to the pipeline';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proposals_guard_conversion ON public.proposals;
CREATE TRIGGER proposals_guard_conversion
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.proposals_guard_conversion();