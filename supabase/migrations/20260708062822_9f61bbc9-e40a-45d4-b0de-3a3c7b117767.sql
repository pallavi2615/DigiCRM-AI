
-- Audit trigger function: writes into activities on insert/update/delete
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity TEXT := TG_TABLE_NAME;
  v_action TEXT;
  v_actor UUID := auth.uid();
  v_entity_id UUID;
  v_desc TEXT;
  v_meta JSONB := '{}'::jsonb;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_action := 'created';
    v_entity_id := NEW.id;
    v_desc := 'Created ' || v_entity;
    v_meta := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Soft delete detection
    IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
      v_action := 'deleted';
      v_desc := 'Deleted ' || v_entity;
    ELSE
      v_action := 'updated';
      v_desc := 'Updated ' || v_entity;
    END IF;
    v_entity_id := NEW.id;
    v_meta := jsonb_build_object(
      'changes', (
        SELECT jsonb_object_agg(key, jsonb_build_object('from', o.value, 'to', n.value))
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
        WHERE o.value IS DISTINCT FROM n.value
          AND key NOT IN ('updated_at')
      )
    );
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'deleted';
    v_entity_id := OLD.id;
    v_desc := 'Deleted ' || v_entity;
    v_meta := to_jsonb(OLD);
  END IF;

  INSERT INTO public.activities (actor_id, entity_type, entity_id, action, description, metadata)
  VALUES (v_actor, v_entity, v_entity_id, v_action, v_desc, COALESCE(v_meta, '{}'::jsonb));

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Allow the trigger (running as definer) to insert without RLS blocking it
-- activities.actor_id can be null (system actions) so relax the insert policy
DROP POLICY IF EXISTS "activities insert" ON public.activities;
CREATE POLICY "activities insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Attach triggers
DROP TRIGGER IF EXISTS audit_leads ON public.leads;
CREATE TRIGGER audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_contacts ON public.contacts;
CREATE TRIGGER audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_companies ON public.companies;
CREATE TRIGGER audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_tasks ON public.tasks;
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

DROP TRIGGER IF EXISTS audit_meetings ON public.meetings;
CREATE TRIGGER audit_meetings
  AFTER INSERT OR UPDATE OR DELETE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- Only admins can view full audit log; normal users see only their own actions
DROP POLICY IF EXISTS "activities read" ON public.activities;
CREATE POLICY "activities read admin all" ON public.activities
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR actor_id = auth.uid());
