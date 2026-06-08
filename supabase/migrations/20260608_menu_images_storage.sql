-- Public bucket for product images uploaded via the admin menu manager
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Admins (authenticated users) can upload/replace images
CREATE POLICY menu_images_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menu-images');
-- Anyone can read product images (storefront display)
CREATE POLICY menu_images_select ON storage.objects FOR SELECT TO public USING (bucket_id = 'menu-images');
-- Admins can overwrite existing images
CREATE POLICY menu_images_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menu-images');
-- Admins can delete images
CREATE POLICY menu_images_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menu-images');
