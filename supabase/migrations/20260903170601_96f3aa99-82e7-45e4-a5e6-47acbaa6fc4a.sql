CREATE OR REPLACE FUNCTION private.enforce_soft_delete_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
     AND auth.uid() IS NOT NULL
     AND NOT private.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied: only administrators can delete %', TG_TABLE_NAME
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_soft_delete_guard ON public.leads;
CREATE TRIGGER trg_leads_soft_delete_guard BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION private.enforce_soft_delete_admin();

DROP TRIGGER IF EXISTS trg_contacts_soft_delete_guard ON public.contacts;
CREATE TRIGGER trg_contacts_soft_delete_guard BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION private.enforce_soft_delete_admin();

DROP TRIGGER IF EXISTS trg_companies_soft_delete_guard ON public.companies;
CREATE TRIGGER trg_companies_soft_delete_guard BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.enforce_soft_delete_admin();