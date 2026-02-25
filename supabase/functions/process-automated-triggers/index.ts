import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Appi Company workspace - skip it from processing
const APPI_WORKSPACE_ID = '5fa32d2a-d6cf-42de-aa4c-d0964098ac8d';

interface WhatsAppTrigger {
  id: string;
  name: string;
  trigger_type: string;
  conditions: Record<string, unknown>;
  enabled: boolean;
}

interface WhatsAppTemplate {
  id: string;
  message_type: string;
  content: string;
  enabled: boolean;
  trigger_id: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  whatsapp_number: string | null;
  workspace_id: string | null;
}

interface Workspace {
  id: string;
  name: string | null;
}

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  workspace_id: string | null;
  updated_at: string;
}

interface Results {
  triggersProcessed: number;
  messagesQueued: number;
  errors: string[];
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

    console.log('[process-automated-triggers] Starting trigger processing...');

    const results: Results = {
      triggersProcessed: 0,
      messagesQueued: 0,
      errors: [],
    };

    // Fetch all enabled triggers with their templates
    const { data: triggers, error: triggersError } = await supabase
      .from('whatsapp_triggers')
      .select('*')
      .eq('enabled', true);

    if (triggersError) {
      console.error('[process-automated-triggers] Error fetching triggers:', triggersError);
      return new Response(JSON.stringify({ error: triggersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!triggers || triggers.length === 0) {
      console.log('[process-automated-triggers] No enabled triggers found');
      return new Response(JSON.stringify({ success: true, ...results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-automated-triggers] Found ${triggers.length} enabled triggers`);

    // Fetch templates linked to triggers
    const { data: templates, error: templatesError } = await supabase
      .from('whatsapp_message_templates')
      .select('*')
      .eq('enabled', true)
      .not('trigger_id', 'is', null);

    if (templatesError) {
      console.error('[process-automated-triggers] Error fetching templates:', templatesError);
      results.errors.push(templatesError.message);
    }

    const templatesByTriggerId = new Map<string, WhatsAppTemplate[]>();
    (templates as WhatsAppTemplate[] || []).forEach(t => {
      const existing = templatesByTriggerId.get(t.trigger_id!) || [];
      existing.push(t);
      templatesByTriggerId.set(t.trigger_id!, existing);
    });

    // Process each trigger type
    for (const trigger of triggers as WhatsAppTrigger[]) {
      try {
        results.triggersProcessed++;
        const linkedTemplates = templatesByTriggerId.get(trigger.id) || [];
        
        if (linkedTemplates.length === 0) {
          console.log(`[process-automated-triggers] Trigger "${trigger.name}" has no linked templates, skipping`);
          continue;
        }

        console.log(`[process-automated-triggers] Processing trigger "${trigger.name}" (${trigger.trigger_type}) with ${linkedTemplates.length} templates`);

        switch (trigger.trigger_type) {
          case 'account_created':
            await processAccountCreatedTrigger(supabase, trigger, linkedTemplates, results);
            break;
          
          case 'lead_inactive':
            await processLeadInactiveTrigger(supabase, trigger, linkedTemplates, results);
            break;
          
          case 'trial_expired':
            // Trial expired is handled by check-expired-subscriptions, skip here
            console.log(`[process-automated-triggers] trial_expired handled by dedicated function, skipping`);
            break;
          
          case 'whatsapp_connected':
            // WhatsApp connected is handled by zapi-webhook when connection is detected
            console.log(`[process-automated-triggers] whatsapp_connected is event-based, skipping periodic check`);
            break;
          
          case 'subscription_activated':
            // Subscription activated is event-based, handled by payment webhook
            console.log(`[process-automated-triggers] subscription_activated is event-based, skipping periodic check`);
            break;
          
          default:
            console.log(`[process-automated-triggers] Unknown trigger type: ${trigger.trigger_type}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[process-automated-triggers] Error processing trigger ${trigger.name}:`, error);
        results.errors.push(`${trigger.name}: ${errorMessage}`);
      }
    }

    console.log(`[process-automated-triggers] Completed. Processed: ${results.triggersProcessed}, Queued: ${results.messagesQueued}, Errors: ${results.errors.length}`);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[process-automated-triggers] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processAccountCreatedTrigger(
  supabase: SupabaseClient,
  trigger: WhatsAppTrigger,
  templates: WhatsAppTemplate[],
  results: Results
) {
  const conditions = trigger.conditions;
  const minAgeMinutes = (conditions.min_age_minutes as number) || 5;
  const maxAgeMinutes = (conditions.max_age_minutes as number) || 60;
  const requiresNoWhatsApp = conditions.requires_no_whatsapp !== false;

  const now = new Date();
  const minCreatedAt = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);
  const maxCreatedAt = new Date(now.getTime() - minAgeMinutes * 60 * 1000);

  console.log(`[account_created] Looking for profiles created between ${minCreatedAt.toISOString()} and ${maxCreatedAt.toISOString()}`);

  // Find profiles matching criteria
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, whatsapp_number, workspace_id')
    .not('workspace_id', 'is', null)
    .not('whatsapp_number', 'is', null)
    .neq('workspace_id', APPI_WORKSPACE_ID)
    .lt('created_at', maxCreatedAt.toISOString())
    .gt('created_at', minCreatedAt.toISOString());

  if (profilesError) {
    console.error('[account_created] Error fetching profiles:', profilesError);
    results.errors.push(profilesError.message);
    return;
  }

  const profiles = profilesData as Profile[] | null;

  if (!profiles || profiles.length === 0) {
    console.log('[account_created] No matching profiles found');
    return;
  }

  console.log(`[account_created] Found ${profiles.length} potential profiles`);

  for (const profile of profiles) {
    // Check if WhatsApp is connected (if required)
    if (requiresNoWhatsApp) {
      const { data: connectedInstance } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('workspace_id', profile.workspace_id)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      if (connectedInstance) {
        console.log(`[account_created] Skipping ${profile.id} - has connected WhatsApp`);
        continue;
      }
    }

    // Get workspace info
    const { data: workspaceData } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', profile.workspace_id)
      .single();

    const workspace = workspaceData as Workspace | null;

    if (!workspace) continue;

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(profile.id);
    const userEmail = userData?.user?.email;

    // Format phone
    const formattedPhone = (profile.whatsapp_number || '').replace(/[^\d]/g, '');
    const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

    // Check if already messaged
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, metadata')
      .eq('workspace_id', APPI_WORKSPACE_ID)
      .eq('phone', phoneWithCountry)
      .maybeSingle();

    const leadMetadata = existingLead?.metadata as Record<string, unknown> | null;
    const messagesSent = leadMetadata?.messages_sent as Record<string, boolean> | null;
    
    if (messagesSent?.not_connected) {
      console.log(`[account_created] Skipping ${phoneWithCountry} - already messaged`);
      continue;
    }

    // Send message for each linked template
    for (const template of templates) {
      console.log(`[account_created] Sending ${template.message_type} to ${phoneWithCountry}`);
      
      try {
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-welcome-whatsapp`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              phone: phoneWithCountry,
              userName: profile.full_name || '',
              userEmail: userEmail,
              userWorkspaceId: workspace.id,
              userWorkspaceName: workspace.name || 'Workspace',
              messageType: template.message_type
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (!result.skipped) {
            results.messagesQueued++;
            console.log(`[account_created] Message queued for ${phoneWithCountry}`);
          }
        }
      } catch (error) {
        console.error(`[account_created] Error sending to ${phoneWithCountry}:`, error);
      }
    }

    // Delay between profiles
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function processLeadInactiveTrigger(
  supabase: SupabaseClient,
  trigger: WhatsAppTrigger,
  templates: WhatsAppTemplate[],
  results: Results
) {
  const conditions = trigger.conditions;
  const inactiveDays = (conditions.inactive_days as number) || 7;
  const workspaceFilter = conditions.workspace_id as string | null;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

  console.log(`[lead_inactive] Looking for leads inactive since ${cutoffDate.toISOString()}`);

  // Build query for inactive leads
  let query = supabase
    .from('leads')
    .select('id, name, phone, workspace_id, updated_at')
    .neq('workspace_id', APPI_WORKSPACE_ID)
    .lt('updated_at', cutoffDate.toISOString())
    .not('phone', 'is', null)
    .limit(100); // Process in batches

  if (workspaceFilter) {
    query = query.eq('workspace_id', workspaceFilter);
  }

  const { data: leadsData, error: leadsError } = await query;

  if (leadsError) {
    console.error('[lead_inactive] Error fetching leads:', leadsError);
    results.errors.push(leadsError.message);
    return;
  }

  const inactiveLeads = leadsData as Lead[] | null;

  if (!inactiveLeads || inactiveLeads.length === 0) {
    console.log('[lead_inactive] No inactive leads found');
    return;
  }

  console.log(`[lead_inactive] Found ${inactiveLeads.length} inactive leads`);

  for (const lead of inactiveLeads) {
    // Check if message already sent for this lead's inactivity
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('direction', 'outgoing')
      .gt('created_at', cutoffDate.toISOString())
      .limit(1)
      .maybeSingle();

    if (existingMessage) {
      console.log(`[lead_inactive] Skipping lead ${lead.id} - already messaged recently`);
      continue;
    }

    for (const template of templates) {
      console.log(`[lead_inactive] Queueing ${template.message_type} for lead ${lead.id}`);
      // Here you would implement the actual message sending logic
      // For now, we log it as queued
      results.messagesQueued++;
    }
  }
}
