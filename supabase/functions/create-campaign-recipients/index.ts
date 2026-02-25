import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCampaignRequest {
  name: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video';
  audience_type: 'leads' | 'csv';
  audience_filters?: {
    status?: string[];
    tags?: string[];
    created_after?: string;
    created_before?: string;
  };
  csv_contacts?: Array<{ phone: string; name?: string }>;
  scheduled_at: string;
  workspace_id: string;
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

    const body: CreateCampaignRequest = await req.json();
    console.log('[create-campaign-recipients] Creating campaign:', body.name);

    // Validate required fields
    if (!body.name || !body.content || !body.scheduled_at || !body.audience_type) {
      throw new Error('Missing required fields: name, content, scheduled_at, audience_type');
    }

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('whatsapp_campaigns')
      .insert({
        workspace_id: body.workspace_id,
        name: body.name,
        content: body.content,
        media_url: body.media_url || null,
        media_type: body.media_type || null,
        audience_type: body.audience_type,
        audience_filters: body.audience_filters || {},
        scheduled_at: body.scheduled_at,
        status: 'scheduled',
      })
      .select()
      .single();

    if (campaignError) {
      console.error('[create-campaign-recipients] Error creating campaign:', campaignError);
      throw campaignError;
    }

    console.log('[create-campaign-recipients] Campaign created:', campaign.id);

    let recipients: Array<{ phone: string; name?: string; lead_id?: string }> = [];

    if (body.audience_type === 'csv' && body.csv_contacts) {
      // Use contacts from CSV
      recipients = body.csv_contacts.map(c => ({
        phone: c.phone,
        name: c.name,
      }));
      console.log(`[create-campaign-recipients] Using ${recipients.length} contacts from CSV`);
    } else if (body.audience_type === 'leads') {
      // Query leads based on filters
      let query = supabase
        .from('leads')
        .select('id, phone, name')
        .eq('workspace_id', body.workspace_id);

      const filters = body.audience_filters || {};

      // Apply status filter
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      // Apply date filters
      if (filters.created_after) {
        query = query.gte('created_at', filters.created_after);
      }
      if (filters.created_before) {
        query = query.lte('created_at', filters.created_before);
      }

      const { data: leads, error: leadsError } = await query;

      if (leadsError) {
        console.error('[create-campaign-recipients] Error fetching leads:', leadsError);
        throw leadsError;
      }

      // If tags filter is specified, we need to filter by tag assignments
      let filteredLeads = leads || [];
      if (filters.tags && filters.tags.length > 0) {
        const { data: tagAssignments } = await supabase
          .from('lead_tag_assignments')
          .select('lead_id')
          .in('tag_id', filters.tags);

        const leadIdsWithTags = new Set(tagAssignments?.map(ta => ta.lead_id) || []);
        filteredLeads = filteredLeads.filter(lead => leadIdsWithTags.has(lead.id));
      }

      recipients = filteredLeads.map(lead => ({
        phone: lead.phone,
        name: lead.name,
        lead_id: lead.id,
      }));
      console.log(`[create-campaign-recipients] Found ${recipients.length} leads matching filters`);
    }

    // Remove duplicates by phone number
    const uniquePhones = new Set<string>();
    const uniqueRecipients = recipients.filter(r => {
      const normalized = r.phone.replace(/\D/g, '');
      if (uniquePhones.has(normalized)) {
        return false;
      }
      uniquePhones.add(normalized);
      return true;
    });

    console.log(`[create-campaign-recipients] ${uniqueRecipients.length} unique recipients after deduplication`);

    // Insert recipients
    if (uniqueRecipients.length > 0) {
      const recipientsToInsert = uniqueRecipients.map(r => ({
        campaign_id: campaign.id,
        phone: r.phone.replace(/\D/g, ''), // Normalize phone
        name: r.name || null,
        lead_id: r.lead_id || null,
        status: 'pending',
      }));

      const { error: recipientsError } = await supabase
        .from('whatsapp_campaign_recipients')
        .insert(recipientsToInsert);

      if (recipientsError) {
        console.error('[create-campaign-recipients] Error inserting recipients:', recipientsError);
        throw recipientsError;
      }
    }

    // Update campaign stats
    await supabase
      .from('whatsapp_campaigns')
      .update({
        stats: { total: uniqueRecipients.length, sent: 0, failed: 0 },
      })
      .eq('id', campaign.id);

    return new Response(JSON.stringify({ 
      success: true, 
      campaign_id: campaign.id,
      recipients_count: uniqueRecipients.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[create-campaign-recipients] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
