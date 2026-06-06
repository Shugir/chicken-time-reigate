INSERT INTO storage.buckets (id, name, public)
VALUES ('brand', 'brand', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY brand_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand');
CREATE POLICY brand_select ON storage.objects FOR SELECT TO public USING (bucket_id = 'brand');
CREATE POLICY brand_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand');
