-- Fix 1: audit_row_change referenced NEW.deleted_at directly, which crashes UPDATE on tables
-- (it_projects, it_tickets, re_clients, re_properties, re_deals, ps_*) that don't have that column.
-- Detect soft-delete via jsonb key presence instead.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_entity TEXT := TG_TABLE_NAME;
  v_action TEXT;
  v_actor UUID := auth.uid();
  v_entity_id UUID;
  v_desc TEXT;
  v_meta JSONB := '{}'::jsonb;
  v_old JSONB;
  v_new JSONB;
  v_has_soft_delete BOOLEAN;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_action := 'created';
    v_entity_id := NEW.id;
    v_desc := 'Created ' || v_entity;
    v_meta := to_jsonb(NEW);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_has_soft_delete := (v_new ? 'deleted_at');
    IF v_has_soft_delete AND (v_new->>'deleted_at') IS NOT NULL AND (v_old->>'deleted_at') IS NULL THEN
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
        FROM jsonb_each(v_old) o
        JOIN jsonb_each(v_new) n USING (key)
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
$function$;

-- Fix 2: Attachments bucket storage RLS only allowed leads/contacts/companies as the
-- top-level folder. Extend it to industry entity types so KYC uploads for real estate
-- clients, IT project/ticket documents, fintech loan docs, and product-sales orders
-- succeed under the same ownership check (private.can_access_entity).
DROP POLICY IF EXISTS "attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments read" ON storage.objects;

CREATE POLICY "attachments insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = ANY (ARRAY[
      'leads','contacts','companies',
      're_clients','re_properties','re_deals',
      'it_projects','it_tickets',
      'loan_applications','loan_documents',
      'ps_orders','ps_products'
    ])
    AND private.can_access_entity((storage.foldername(name))[1], NULLIF((storage.foldername(name))[2], '')::uuid)
  );

CREATE POLICY "attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = ANY (ARRAY[
      'leads','contacts','companies',
      're_clients','re_properties','re_deals',
      'it_projects','it_tickets',
      'loan_applications','loan_documents',
      'ps_orders','ps_products'
    ])
    AND private.can_access_entity((storage.foldername(name))[1], NULLIF((storage.foldername(name))[2], '')::uuid)
  );