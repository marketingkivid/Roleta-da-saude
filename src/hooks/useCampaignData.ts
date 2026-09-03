import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Campaign = Tables<'campaigns'>;

export function useCampaignData() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [prizeCounts, setPrizeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setCampaigns(data);
      // Fetch participant counts and prize counts in parallel
      const [participantRes, prizeRes] = await Promise.all([
        supabase.from('campaign_participants').select('campaign_id'),
        supabase.from('prizes').select('campaign_id'),
      ]);
      if (participantRes.data) {
        const map: Record<string, number> = {};
        participantRes.data.forEach(row => {
          map[row.campaign_id] = (map[row.campaign_id] || 0) + 1;
        });
        setParticipantCounts(map);
      }
      if (prizeRes.data) {
        const map: Record<string, number> = {};
        prizeRes.data.forEach(row => {
          if (row.campaign_id) {
            map[row.campaign_id] = (map[row.campaign_id] || 0) + 1;
          }
        });
        setPrizeCounts(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { campaigns, participantCounts, prizeCounts, loading, refetch: fetchCampaigns };
}
