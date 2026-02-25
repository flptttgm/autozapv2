import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeAppointments(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          console.log('[Realtime] Appointment change:', payload.eventType);
          
          // Invalidate all appointment-related queries
          queryClient.invalidateQueries({ queryKey: ['week-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['month-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['appointments-by-instance'] });
          queryClient.invalidateQueries({ queryKey: ['appointments-today'] });
          queryClient.invalidateQueries({ queryKey: ['confirmed-appointments-today'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, queryClient]);
}
