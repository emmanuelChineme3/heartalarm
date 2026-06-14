
CREATE POLICY "stories read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories');

CREATE POLICY "stories insert own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "stories delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'stories' AND (storage.foldername(name))[1] = auth.uid()::text);
