import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly'
].join(' ');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const authHeader = req.headers.get('Authorization');

    if (req.method === 'GET') {
      // Generate OAuth URL
      const workspaceId = url.searchParams.get('workspace_id');
      const redirectUri = url.searchParams.get('redirect_uri');
      
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: 'workspace_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get workspace credentials
      const { data: integration } = await supabase
        .from('calendar_integrations')
        .select('credentials')
        .eq('workspace_id', workspaceId)
        .eq('provider', 'google')
        .maybeSingle();

      if (!integration?.credentials?.client_id) {
        return new Response(JSON.stringify({ error: 'Google credentials not configured' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const credentials = integration.credentials as {
        client_id: string;
        client_secret: string;
      };

      const state = JSON.stringify({ workspace_id: workspaceId });
      const authUrl = `${GOOGLE_AUTH_URL}?` + new URLSearchParams({
        client_id: credentials.client_id,
        redirect_uri: redirectUri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth/callback`,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: encodeURIComponent(state),
      });

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { action } = body;

      if (action === 'exchange_code') {
        // Exchange authorization code for tokens
        const { code, workspace_id, redirect_uri } = body;

        if (!code || !workspace_id) {
          return new Response(JSON.stringify({ error: 'code and workspace_id required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get workspace credentials
        const { data: integration } = await supabase
          .from('calendar_integrations')
          .select('id, credentials')
          .eq('workspace_id', workspace_id)
          .eq('provider', 'google')
          .maybeSingle();

        if (!integration?.credentials?.client_id || !integration?.credentials?.client_secret) {
          return new Response(JSON.stringify({ error: 'Google credentials not configured' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const credentials = integration.credentials as {
          client_id: string;
          client_secret: string;
        };

        // Exchange code for tokens
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: credentials.client_id,
            client_secret: credentials.client_secret,
            redirect_uri: redirect_uri || `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth/callback`,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.text();
          console.error('Token exchange error:', error);
          return new Response(JSON.stringify({ error: 'Failed to exchange code' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tokens = await tokenResponse.json();
        console.log('Tokens received successfully');

        // Update integration with tokens
        const updatedCredentials = {
          ...credentials,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        };

        await supabase
          .from('calendar_integrations')
          .update({
            credentials: updatedCredentials,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'save_credentials') {
        // Save Google Client ID and Secret
        const { workspace_id, client_id, client_secret } = body;

        if (!workspace_id || !client_id || !client_secret) {
          return new Response(JSON.stringify({ error: 'workspace_id, client_id, and client_secret required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if integration exists
        const { data: existing } = await supabase
          .from('calendar_integrations')
          .select('id, credentials')
          .eq('workspace_id', workspace_id)
          .eq('provider', 'google')
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from('calendar_integrations')
            .update({
              credentials: {
                ...existing.credentials,
                client_id,
                client_secret,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          // Create new
          await supabase
            .from('calendar_integrations')
            .insert({
              workspace_id,
              provider: 'google',
              credentials: { client_id, client_secret },
              is_active: false,
            });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'disconnect') {
        const { workspace_id } = body;

        await supabase
          .from('calendar_integrations')
          .update({
            credentials: {},
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('workspace_id', workspace_id)
          .eq('provider', 'google');

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'get_status') {
        const { workspace_id } = body;

        const { data: integration } = await supabase
          .from('calendar_integrations')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('provider', 'google')
          .maybeSingle();

        const credentials = integration?.credentials as {
          client_id?: string;
          client_secret?: string;
          access_token?: string;
          refresh_token?: string;
        } | null;

        return new Response(JSON.stringify({
          configured: !!credentials?.client_id,
          connected: !!credentials?.access_token,
          is_active: integration?.is_active || false,
          calendar_id: integration?.calendar_id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-calendar-auth:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
