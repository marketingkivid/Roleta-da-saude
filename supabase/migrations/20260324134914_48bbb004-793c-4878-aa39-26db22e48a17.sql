
-- Create prize-images bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('prize-images', 'prize-images', true);

-- Allow anyone to read files (public bucket for prize display)
CREATE POLICY "Anyone can read prize images"
ON storage.objects FOR SELECT
USING (bucket_id = 'prize-images');

-- Allow admins to upload prize images
CREATE POLICY "Admins can upload prize images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prize-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow admins to update prize images
CREATE POLICY "Admins can update prize images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prize-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow admins to delete prize images
CREATE POLICY "Admins can delete prize images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prize-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
