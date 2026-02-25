import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Appi Company workspace - skip it from processing
const APPI_WORKSPACE_ID = '5fa32d2a-d6cf-42de-aa4c-d0964098ac8d';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[check-new-accounts] Starting check for new accounts without WhatsApp connected...');

    // Find profiles created 5+ minutes ago but less than 1 hour ago
    // that have whatsapp_number but no connected WhatsApp instance
    const { data: newAccounts, error: queryError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        whatsapp_number,
        workspace_id
      `)
      .not('workspace_id', 'is', null)
      .not('whatsapp_number', 'is', null)
      .neq('workspace_id', APPI_WORKSPACE_ID)
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())  // Created > 5 min ago
      .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Created < 1 hour ago

    if (queryError) {
      console.error('[check-new-accounts] Error fetching profiles:', queryError);
      return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!newAccounts || newAccounts.length === 0) {
      console.log('[check-new-accounts] No new accounts found in time window');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[check-new-accounts] Found ${newAccounts.length} potential accounts to check`);

    let processed = 0;
    let skipped = 0;

    for (const account of newAccounts) {
      const workspaceId = account.workspace_id;
      
      if (!workspaceId) {
        console.log(`[check-new-accounts] Skipping account ${account.id} - no workspace`);
        skipped++;
        continue;
      }

      // Fetch workspace info
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id, name, owner_id')
        .eq('id', workspaceId)
        .single();

      if (!workspace) {
        console.log(`[check-new-accounts] Skipping account ${account.id} - workspace not found`);
        skipped++;
        continue;
      }

      // Check if workspace has any connected WhatsApp instance
      const { data: connectedInstance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      if (connectedInstance) {
        console.log(`[check-new-accounts] Skipping workspace ${workspaceId} - already has connected instance`);
        skipped++;
        continue;
      }

      // Check if welcome message was already sent by looking at Appi leads
      const formattedPhone = account.whatsapp_number.replace(/[^\d]/g, '');
      const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, metadata')
        .eq('workspace_id', APPI_WORKSPACE_ID)
        .eq('phone', phoneWithCountry)
        .maybeSingle();

      if (existingLead?.metadata?.messages_sent?.not_connected) {
        console.log(`[check-new-accounts] Skipping ${phoneWithCountry} - already received not_connected message`);
        skipped++;
        continue;
      }

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(account.id);
      const userEmail = userData?.user?.email;

      console.log(`[check-new-accounts] Sending welcome to ${account.full_name || 'User'} (${phoneWithCountry})`);

      // Send welcome message
      const sendResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            phone: phoneWithCountry,
            userName: account.full_name || '',
            userEmail: userEmail,
            userWorkspaceId: workspaceId,
            userWorkspaceName: workspace.name || 'Workspace',
            messageType: 'not_connected'
          })
        }
      );

      if (sendResponse.ok) {
        const result = await sendResponse.json();
        if (result.skipped) {
          console.log(`[check-new-accounts] Message skipped for ${phoneWithCountry}: ${result.skipped}`);
          skipped++;
        } else {
          console.log(`[check-new-accounts] Successfully sent welcome to ${phoneWithCountry}`);
          processed++;
        }
      } else {
        const errorText = await sendResponse.text();
        console.error(`[check-new-accounts] Failed to send welcome to ${phoneWithCountry}:`, errorText);
        skipped++;
      }

      // Small delay between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`[check-new-accounts] Completed. Processed: ${processed}, Skipped: ${skipped}`);

    return new Response(JSON.stringify({ 
      success: true, 
      total: newAccounts.length,
      processed, 
      skipped 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[check-new-accounts] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
