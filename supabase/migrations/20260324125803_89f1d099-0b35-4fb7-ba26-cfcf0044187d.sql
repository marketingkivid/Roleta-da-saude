
-- Make the public read policy for campaign_participants more restrictive
DROP POLICY "Public can read own token" ON public.campaign_participants;

CREATE POLICY "Public can read by token" ON public.campaign_participants
  FOR SELECT TO anon, authenticated
  USING (unique_token = current_setting('request.headers', true)::json->>'x-participant-token'
    OR has_role(auth.uid(), 'admin'));
