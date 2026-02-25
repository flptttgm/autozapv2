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

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "invoiceId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invoice with lead data
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select(`
        *,
        lead:leads(id, name, phone, whatsapp_instance_id)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice.lead) {
      return new Response(
        JSON.stringify({ error: "Invoice has no associated lead" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get WhatsApp instance - try lead's instance first, then fallback to workspace's active instance
    let whatsappInstance = null;
    
    if (invoice.lead.whatsapp_instance_id) {
      const { data } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", invoice.lead.whatsapp_instance_id)
        .single();
      whatsappInstance = data;
    }
    
    // Fallback: get any connected instance from the workspace
    if (!whatsappInstance) {
      const { data } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("workspace_id", invoice.workspace_id)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      whatsappInstance = data;
    }

    if (!whatsappInstance) {
      return new Response(
        JSON.stringify({ 
          error: "Nenhuma conexão WhatsApp ativa encontrada. Conecte seu WhatsApp primeiro.",
          code: "NO_WHATSAPP_INSTANCE"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format due date
    const dueDate = new Date(invoice.due_date);
    const formattedDate = dueDate.toLocaleDateString('pt-BR');

    // Format amount
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(invoice.amount);

    // Prepare messages
    const leadName = invoice.lead.name || 'Cliente';
    const description = invoice.description || 'Cobrança';

    const messages = [
      {
        type: 'text',
        content: `Olá ${leadName}! 👋\n\nSegue sua cobrança:\n\n📋 *${description}*\n💰 Valor: *${formattedAmount}*\n📅 Vencimento: *${formattedDate}*\n\nPara pagar, use o PIX abaixo:`
      },
      {
        type: 'text',
        content: `*Código PIX (Copia e Cola):*\n\n\`\`\`${invoice.pix_code}\`\`\`\n\n_Copie o código acima e cole no seu aplicativo de banco._`
      },
      {
        type: 'image',
        content: invoice.pix_qr_code,
        caption: '📱 Ou escaneie o QR Code acima para pagar'
      }
    ];

    // Send messages via Z-API
    const zapiBaseUrl = `https://api.z-api.io/instances/${whatsappInstance.instance_id}/token/${whatsappInstance.instance_token}`;
    const clientToken = Deno.env.get('ZAPI_USER_TOKEN');
    const phone = invoice.lead.phone.replace(/\D/g, '');

    for (const msg of messages) {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (msg.type === 'text') {
        endpoint = '/send-text';
        body = {
          phone,
          message: msg.content
        };
      } else if (msg.type === 'image') {
        endpoint = '/send-image';
        body = {
          phone,
          image: msg.content,
          caption: msg.caption || ''
        };
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (clientToken) {
        headers['client-token'] = clientToken;
      }

      const response = await fetch(`${zapiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error sending ${msg.type}:`, errorText);
      }

      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Update invoice status to sent
    await supabaseClient
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString()
      })
      .eq("id", invoiceId);

    // Save messages to database
    const chatId = phone.includes('@') ? phone : `${phone}@c.us`;
    
    for (const msg of messages) {
      if (msg.type === 'text') {
        await supabaseClient
          .from("messages")
          .insert({
            workspace_id: invoice.workspace_id,
            lead_id: invoice.lead.id,
            chat_id: chatId,
            content: msg.content,
            direction: 'outbound',
            message_type: 'text',
            metadata: { invoice_id: invoiceId, type: 'invoice_message' }
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice sent successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-invoice:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
