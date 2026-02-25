import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderSettings {
  enabled: boolean;
  hours_before: number[];
}

// Default settings for workspaces without explicit configuration
const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,
  hours_before: [24, 1]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting appointment reminders check...');

    const now = new Date();
    let remindersSent = 0;

    // 1. Get all workspaces with upcoming appointments in the next 24 hours
    const maxLookAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: upcomingAppointments, error: apptError } = await supabase
      .from('appointments')
      .select('workspace_id')
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', now.toISOString())
      .lte('start_time', maxLookAhead.toISOString());

    if (apptError) {
      console.error('Error fetching upcoming appointments:', apptError);
      throw apptError;
    }

    // Get unique workspace IDs
    const uniqueWorkspaceIds = [...new Set(
      upcomingAppointments?.map(a => a.workspace_id).filter(Boolean) as string[]
    )];

    console.log(`Found ${uniqueWorkspaceIds.length} workspaces with upcoming appointments`);

    // 2. Process each workspace
    for (const workspaceId of uniqueWorkspaceIds) {
      // Fetch reminder config for this workspace
      const { data: configData } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('workspace_id', workspaceId)
        .eq('config_key', 'appointment_reminders')
        .maybeSingle();

      // Use default settings if no config exists
      const settings = (configData?.config_value as ReminderSettings) ?? DEFAULT_SETTINGS;
      
      // Skip if explicitly disabled
      if (settings.enabled === false) {
        console.log(`Workspace ${workspaceId} has reminders disabled, skipping`);
        continue;
      }

      const hoursBefore = settings.hours_before ?? DEFAULT_SETTINGS.hours_before;

      // Fetch timezone for this workspace
      const { data: timezoneData } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('workspace_id', workspaceId)
        .eq('config_key', 'timezone')
        .maybeSingle();

      const timezoneOffset = (timezoneData?.config_value as { offset?: number })?.offset ?? -3; // Default Brasília

      console.log(`Processing workspace ${workspaceId} with hours_before:`, hoursBefore, 'timezone:', timezoneOffset);

      // Get appointments for each reminder window
      for (const hoursBeforeValue of hoursBefore) {
        const targetTime = new Date(now.getTime() + hoursBeforeValue * 60 * 60 * 1000);
        const windowStart = new Date(targetTime.getTime() - 5 * 60 * 1000); // 5 min before
        const windowEnd = new Date(targetTime.getTime() + 5 * 60 * 1000); // 5 min after

        const { data: appointments, error: fetchError } = await supabase
          .from('appointments')
          .select(`
            id,
            title,
            start_time,
            lead_id,
            metadata,
            leads!inner (
              id,
              phone,
              name
            )
          `)
          .eq('workspace_id', workspaceId)
          .in('status', ['scheduled', 'confirmed'])
          .gte('start_time', windowStart.toISOString())
          .lte('start_time', windowEnd.toISOString());

        if (fetchError) {
          console.error('Error fetching appointments:', fetchError);
          continue;
        }

        for (const appointment of appointments || []) {
          const metadata = (appointment.metadata || {}) as Record<string, unknown>;
          const sentReminders = (metadata.sent_reminders || []) as string[];
          const reminderKey = `${hoursBeforeValue}h`;

          // Skip if this reminder was already sent
          if (sentReminders.includes(reminderKey)) {
            console.log(`Reminder ${reminderKey} already sent for appointment ${appointment.id}`);
            continue;
          }

          const lead = (appointment.leads as unknown as { id: string; phone: string; name: string | null });
          if (!lead?.phone) {
            console.log(`No phone for lead in appointment ${appointment.id}`);
            continue;
          }

          // Format the reminder message - Convert UTC to local time for display
          const appointmentDateUTC = new Date(appointment.start_time);
          const displayTime = new Date(appointmentDateUTC.getTime() + (timezoneOffset * 60 * 60 * 1000));
          
          const formattedDate = displayTime.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
          const formattedTime = displayTime.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          console.log('[appointment-reminders] Time formatting:', {
            utcTime: appointmentDateUTC.toISOString(),
            timezoneOffset,
            displayTime: displayTime.toISOString(),
            formattedTime
          });

          const message = hoursBeforeValue >= 24
            ? `⏰ Lembrete: Você tem um agendamento amanhã!\n\n📅 ${appointment.title}\n🗓️ ${formattedDate}\n⏰ ${formattedTime}\n\nNos vemos em breve!`
            : `⏰ Lembrete: Seu agendamento é em ${hoursBeforeValue} hora${hoursBeforeValue > 1 ? 's' : ''}!\n\n📅 ${appointment.title}\n🗓️ ${formattedDate}\n⏰ ${formattedTime}\n\nNos vemos em breve!`;

          // Send the reminder via send-message function
          const chatId = `${lead.phone}@c.us`;
          
          try {
            const { error: sendError } = await supabase.functions.invoke('send-message', {
              body: {
                chat_id: chatId,
                message: message,
                lead_id: lead.id,
                is_manual: false
              }
            });

            if (sendError) {
              console.error(`Error sending reminder for appointment ${appointment.id}:`, sendError);
              continue;
            }

            // Mark reminder as sent
            const updatedReminders = [...sentReminders, reminderKey];
            await supabase
              .from('appointments')
              .update({
                metadata: { ...metadata, sent_reminders: updatedReminders }
              })
              .eq('id', appointment.id);

            console.log(`Sent ${reminderKey} reminder for appointment ${appointment.id}`);
            remindersSent++;
          } catch (err) {
            console.error(`Failed to send reminder:`, err);
          }
        }
      }
    }

    console.log(`Finished. Sent ${remindersSent} reminders.`);

    return new Response(JSON.stringify({ 
      success: true, 
      reminders_sent: remindersSent 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in appointment-reminders:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
