
-- Public read for cms-media bucket (workspace blocks public buckets, so grant anon SELECT via RLS)
CREATE POLICY "cms_media_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'cms-media');

CREATE POLICY "cms_media_super_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'cms-media' AND private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "cms_media_super_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'cms-media' AND private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "cms_media_super_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'cms-media' AND private.has_role(auth.uid(), 'super_admin'::app_role));
