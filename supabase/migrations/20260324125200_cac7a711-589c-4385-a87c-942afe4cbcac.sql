-- Drop the overly permissive policy and replace with anon-scoped one
DROP POLICY "Anyone can insert participation" ON public.participations;
CREATE POLICY "Anon and authenticated can insert participation" ON public.participations
  FOR INSERT TO anon, authenticated WITH CHECK (true);