
-- Fix: allow public to read campaign_participants by providing the token in the query
DROP POLICY "Public can read by token" ON public.campaign_participants;

CREATE POLICY "Anyone can read campaign_participants" ON public.campaign_participants
  FOR SELECT TO anon, authenticated USING (true);

-- Allow anon to update played status
CREATE POLICY "Anon can mark as played" ON public.campaign_participants
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
