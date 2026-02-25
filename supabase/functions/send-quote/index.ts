import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { quoteId } = await req.json();

    if (!quoteId) {
      return new Response(
        JSON.stringify({ error: "quoteId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-quote] Processing quote: ${quoteId}`);

    // Get quote with lead data
    const { data: quote, error: quoteError } = await supabaseClient
      .from("quotes")
      .select(`
        *,
        lead:leads(id, name, phone, whatsapp_instance_id)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("[send-quote] Quote not found:", quoteError);
      return new Response(
        JSON.stringify({ error: "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!quote.lead) {
      return new Response(
        JSON.stringify({ error: "Quote has no associated lead" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp instance - try lead's instance first, then fallback to workspace's active instance
    let whatsappInstance = null;
    
    if (quote.lead.whatsapp_instance_id) {
      const { data } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", quote.lead.whatsapp_instance_id)
        .single();
      whatsappInstance = data;
    }
    
    // Fallback: get any connected instance from the workspace
    if (!whatsappInstance) {
      const { data } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("workspace_id", quote.workspace_id)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      whatsappInstance = data;
    }

    if (!whatsappInstance) {
      console.error("[send-quote] No WhatsApp instance found");
      return new Response(
        JSON.stringify({ 
          error: "Nenhuma conexão WhatsApp ativa encontrada. Conecte seu WhatsApp primeiro.",
          code: "NO_WHATSAPP_INSTANCE"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format data
    const leadName = quote.lead.name || 'Cliente';
    const description = quote.ai_summary || 'Orçamento';
    
    // Format value
    const formattedValue = quote.estimated_value 
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.estimated_value)
      : null;
    
    // Format valid until
    const validUntilFormatted = quote.valid_until 
      ? new Date(quote.valid_until).toLocaleDateString('pt-BR')
      : null;

    // Build items list
    let itemsList = '';
    if (quote.items && Array.isArray(quote.items) && quote.items.length > 0) {
      itemsList = '\n\n*Itens/Serviços:*\n' + quote.items.map((item: { name?: string; value?: string } | string) => {
        if (typeof item === 'string') return `• ${item}`;
        const itemValue = item.value ? ` - R$ ${item.value}` : '';
        return `• ${item.name || 'Item'}${itemValue}`;
      }).join('\n');
    }

    // Build message
    let messageContent = `Olá ${leadName}! 👋\n\nSegue o orçamento solicitado:\n\n📋 *${description}*`;
    
    if (itemsList) {
      messageContent += itemsList;
    }
    
    if (formattedValue) {
      messageContent += `\n\n💰 *Valor Total: ${formattedValue}*`;
    }
    
    if (validUntilFormatted) {
      messageContent += `\n📅 *Válido até: ${validUntilFormatted}*`;
    }
    
    messageContent += '\n\nQualquer dúvida, estou à disposição! 😊';

    console.log(`[send-quote] Sending message to ${quote.lead.phone}`);

    // Send message via Z-API
    const zapiBaseUrl = `https://api.z-api.io/instances/${whatsappInstance.instance_id}/token/${whatsappInstance.instance_token}`;
    const clientToken = Deno.env.get('ZAPI_USER_TOKEN');
    const phone = quote.lead.phone.replace(/\D/g, '');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) {
      headers['client-token'] = clientToken;
    }

    const response = await fetch(`${zapiBaseUrl}/send-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        message: messageContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[send-quote] Error sending message:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao enviar mensagem via WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update quote sent_at
    await supabaseClient
      .from("quotes")
      .update({
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", quoteId);

    // Update lead score +5 for quote sent
    const { data: currentLead } = await supabaseClient
      .from("leads")
      .select("score")
      .eq("id", quote.lead.id)
      .single();
    
    const currentScore = currentLead?.score || 0;
    const newScore = Math.max(0, currentScore + 5);
    
    await supabaseClient
      .from("leads")
      .update({ 
        score: newScore,
        updated_at: new Date().toISOString()
      })
      .eq("id", quote.lead.id);
    
    console.log(`[send-quote] Lead score updated: +5 for quote_sent (${currentScore} → ${newScore})`);

    // Save message to database
    // Use existing chat_id from lead's messages to prevent duplicate conversations
    let chatId = phone.includes('@') ? phone : `${phone}@c.us`;
    
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('chat_id')
      .eq('lead_id', quote.lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMessage?.chat_id && existingMessage.chat_id !== chatId) {
      console.log(`[send-quote] Using existing chat_id: ${existingMessage.chat_id} instead of generated: ${chatId}`);
      chatId = existingMessage.chat_id;
    }
    
    await supabaseClient
      .from("messages")
      .insert({
        workspace_id: quote.workspace_id,
        lead_id: quote.lead.id,
        chat_id: chatId,
        content: messageContent,
        direction: 'outbound',
        message_type: 'text',
        metadata: { quote_id: quoteId, type: 'quote_message' }
      });

    console.log(`[send-quote] Quote sent successfully: ${quoteId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Quote sent successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[send-quote] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
