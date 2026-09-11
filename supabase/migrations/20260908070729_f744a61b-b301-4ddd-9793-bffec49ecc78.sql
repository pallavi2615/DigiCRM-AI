
CREATE OR REPLACE FUNCTION public.sync_lead_conversion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := CASE WHEN NEW.won IS TRUE THEN 'won'
                   WHEN NEW.won IS FALSE THEN 'lost'
                   ELSE 'open' END;
  UPDATE public.lead_conversions
     SET stage = NEW.stage,
         status = v_status,
         revenue = CASE WHEN NEW.won IS TRUE THEN COALESCE(NEW.value, 0) ELSE 0 END,
         occurred_at = now()
   WHERE pack_record_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_lead_conversion() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_lead_conversion ON public.pack_records;
CREATE TRIGGER trg_sync_lead_conversion
AFTER UPDATE OF stage, won, value ON public.pack_records
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_conversion();
