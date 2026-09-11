
-- Helper: can current user access a given entity row (mirrors SELECT policies)
CREATE OR REPLACE FUNCTION private.can_access_entity(_entity_type text, _entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  uid uuid := auth.uid();
  ok boolean := false;
BEGIN
  IF uid IS NULL OR _entity_id IS NULL THEN
    RETURN false;
  END IF;
  IF private.is_manager_or_above(uid) THEN
    RETURN true;
  END IF;
  IF _entity_type = 'leads' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = _entity_id AND l.deleted_at IS NULL
        AND (l.assigned_to = uid OR l.created_by = uid)
    ) INTO ok;
  ELSIF _entity_type = 'contacts' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = _entity_id AND c.deleted_at IS NULL
        AND (
          c.created_by = uid
          OR c.company_id IN (SELECT id FROM public.companies WHERE created_by = uid)
          OR c.company_id IN (SELECT company_id FROM public.leads WHERE company_id IS NOT NULL AND (assigned_to = uid OR created_by = uid))
        )
    ) INTO ok;
  ELSIF _entity_type = 'companies' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.companies co
      WHERE co.id = _entity_id AND co.deleted_at IS NULL
        AND (
          co.created_by = uid
          OR co.id IN (SELECT company_id FROM public.leads WHERE company_id IS NOT NULL AND (assigned_to = uid OR created_by = uid))
        )
    ) INTO ok;
  END IF;
  RETURN COALESCE(ok, false);
END;
$$;

REVOKE ALL ON FUNCTION private.can_access_entity(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_access_entity(text, uuid) TO authenticated, service_role;

-- Storage RLS on attachments bucket
-- Path format: {entity_type}/{entity_id}/{filename}, entity_type ∈ (leads,contacts,companies)
DROP POLICY IF EXISTS "attachments read" ON storage.objects;
DROP POLICY IF EXISTS "attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "attachments update" ON storage.objects;
DROP POLICY IF EXISTS "attachments delete" ON storage.objects;

CREATE POLICY "attachments read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] IN ('leads','contacts','companies')
  AND private.can_access_entity(
    (storage.foldername(name))[1],
    NULLIF((storage.foldername(name))[2], '')::uuid
  )
);

CREATE POLICY "attachments insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] IN ('leads','contacts','companies')
  AND private.can_access_entity(
    (storage.foldername(name))[1],
    NULLIF((storage.foldername(name))[2], '')::uuid
  )
);

CREATE POLICY "attachments update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND private.can_access_entity(
    (storage.foldername(name))[1],
    NULLIF((storage.foldername(name))[2], '')::uuid
  )
);

CREATE POLICY "attachments delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND private.can_access_entity(
    (storage.foldername(name))[1],
    NULLIF((storage.foldername(name))[2], '')::uuid
  )
);
