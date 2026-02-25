import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleCredentials {
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
}

async function refreshAccessToken(
  supabase: any,
  integrationId: string,
  credentials: GoogleCredentials
): Promise<string> {
  const tokenExpiry = new Date(credentials.token_expiry);
  const now = new Date();

  // If token is still valid, return it
  if (tokenExpiry > now) {
    return credentials.access_token;
  }

  console.log('Refreshing access token...');

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh access token');
  }

  const tokens = await tokenResponse.json();

  // Update stored tokens
  await supabase
    .from('calendar_integrations')
    .update({
      credentials: {
        ...credentials,
        access_token: tokens.access_token,
        token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  return tokens.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, workspace_id } = body;

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get integration
    const { data: integration } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ error: 'Google Calendar not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const credentials = integration.credentials as GoogleCredentials;
    const accessToken = await refreshAccessToken(supabase, integration.id, credentials);
    const calendarId = integration.calendar_id || 'primary';

    if (action === 'list_calendars') {
      const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to list calendars');
      }

      const data = await response.json();
      return new Response(JSON.stringify({ calendars: data.items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_calendar') {
      const { calendar_id } = body;

      await supabase
        .from('calendar_integrations')
        .update({
          calendar_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_events') {
      const { time_min, time_max } = body;

      const params = new URLSearchParams({
        timeMin: time_min || new Date().toISOString(),
        timeMax: time_max || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new Error('Failed to list events');
      }

      const data = await response.json();
      return new Response(JSON.stringify({ events: data.items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_event') {
      const { title, description, start_time, end_time, attendees } = body;

      const event = {
        summary: title,
        description,
        start: {
          dateTime: start_time,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: end_time,
          timeZone: 'America/Sao_Paulo',
        },
        attendees: attendees?.map((email: string) => ({ email })) || [],
      };

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Create event error:', error);
        throw new Error('Failed to create event');
      }

      const createdEvent = await response.json();
      return new Response(JSON.stringify({ event: createdEvent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_event') {
      const { event_id, title, description, start_time, end_time } = body;

      const event = {
        summary: title,
        description,
        start: {
          dateTime: start_time,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: end_time,
          timeZone: 'America/Sao_Paulo',
        },
      };

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${event_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      const updatedEvent = await response.json();
      return new Response(JSON.stringify({ event: updatedEvent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete_event') {
      const { event_id } = body;

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${event_id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      );

      if (!response.ok && response.status !== 410) {
        throw new Error('Failed to delete event');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync_appointment') {
      // Sync a single appointment to Google Calendar
      const { appointment_id } = body;

      const { data: appointment } = await supabase
        .from('appointments')
        .select('*, leads(name, phone, email)')
        .eq('id', appointment_id)
        .single();

      if (!appointment) {
        return new Response(JSON.stringify({ error: 'Appointment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const event = {
        summary: appointment.title,
        description: `${appointment.description || ''}\n\nCliente: ${appointment.leads?.name || 'N/A'}\nTelefone: ${appointment.leads?.phone || 'N/A'}`,
        start: {
          dateTime: appointment.start_time,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: appointment.end_time,
          timeZone: 'America/Sao_Paulo',
        },
      };

      let response;
      if (appointment.google_calendar_event_id) {
        // Update existing event
        response = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${appointment.google_calendar_event_id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );
      } else {
        // Create new event
        response = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );
      }

      if (!response.ok) {
        throw new Error('Failed to sync event');
      }

      const syncedEvent = await response.json();

      // Update appointment with Google Calendar event ID
      await supabase
        .from('appointments')
        .update({
          google_calendar_event_id: syncedEvent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointment_id);

      return new Response(JSON.stringify({ event: syncedEvent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-calendar-sync:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
