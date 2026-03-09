import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        const { message_id } = await req.json();

        if (!message_id) {
            throw new Error('message_id is required');
        }

        // 1. Look up the message
        const { data: msg, error: msgError } = await supabase
            .from('messages')
            .select('id, chat_id, lead_id, workspace_id, direction, zapi_message_id, metadata')
            .eq('id', message_id)
            .single();

        if (msgError || !msg) {
            throw new Error('Message not found');
        }

        // 2. Only allow deleting outbound messages
        if (msg.direction !== 'outbound' && msg.direction !== 'outbound_manual') {
            throw new Error('Only outbound messages can be deleted');
        }

        // 3. Get the phone number from the lead (or fallback to chat_id)
        let phone = msg.chat_id;
        if (msg.lead_id) {
            const { data: lead } = await supabase
                .from('leads')
                .select('phone')
                .eq('id', msg.lead_id)
                .single();
            if (lead?.phone) {
                phone = lead.phone;
            }
        }

        // 4. Delete from WhatsApp via Z-API (required — must have zapi_message_id)

        if (msg.zapi_message_id) {
            // Get Z-API credentials
            const instanceId = (msg.metadata as any)?.instanceId;
            let zapiInstanceId: string | null = null;
            let zapiInstanceToken: string | null = null;
            let clientToken: string | null = null;

            if (instanceId) {
                const { data: instance } = await supabase
                    .from('whatsapp_instances')
                    .select('instance_id, instance_token')
                    .eq('instance_id', instanceId)
                    .eq('workspace_id', msg.workspace_id)
                    .maybeSingle();

                if (instance) {
                    zapiInstanceId = instance.instance_id;
                    zapiInstanceToken = instance.instance_token;
                    clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
                }
            }

            // Fallback: get any connected instance for this workspace
            if (!zapiInstanceId) {
                const { data: instance } = await supabase
                    .from('whatsapp_instances')
                    .select('instance_id, instance_token')
                    .eq('workspace_id', msg.workspace_id)
                    .eq('status', 'connected')
                    .limit(1)
                    .maybeSingle();

                if (instance) {
                    zapiInstanceId = instance.instance_id;
                    zapiInstanceToken = instance.instance_token;
                    clientToken = Deno.env.get('ZAPI_USER_TOKEN') || null;
                }
            }

            if (!zapiInstanceId || !zapiInstanceToken || !clientToken) {
                throw new Error('Não foi possível apagar: credenciais da instância WhatsApp não encontradas');
            }

            const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiInstanceToken}/messages?messageId=${encodeURIComponent(msg.zapi_message_id)}&phone=${encodeURIComponent(phone)}&owner=true`;

            console.log('[delete-message] Calling Z-API DELETE:', zapiUrl);

            const zapiResponse = await fetch(zapiUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'client-token': clientToken,
                },
            });

            if (!zapiResponse.ok && zapiResponse.status !== 204) {
                const errorText = await zapiResponse.text();
                console.error('[delete-message] Z-API delete failed:', zapiResponse.status, errorText);
                throw new Error('Não foi possível apagar a mensagem do WhatsApp. Tente novamente.');
            }

            console.log('[delete-message] Z-API delete successful');
        } else {
            throw new Error('Mensagem não possui ID do WhatsApp — não é possível apagar');
        }

        // 5. Delete from database
        const { error: deleteError } = await supabase
            .from('messages')
            .delete()
            .eq('id', message_id);

        if (deleteError) {
            throw new Error(`Failed to delete message from database: ${deleteError.message}`);
        }

        console.log('[delete-message] Message deleted successfully:', { message_id });

        return new Response(
            JSON.stringify({ success: true }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('[delete-message] Error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
