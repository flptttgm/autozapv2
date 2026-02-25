import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CRC16 CCITT calculation for PIX
function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Format EMV field
function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

// Generate PIX EMV code (BR Code)
function generatePixCode(
  pixKey: string,
  receiverName: string,
  receiverCity: string,
  amount: number,
  txId: string
): string {
  // Payload Format Indicator
  let payload = emvField('00', '01');
  
  // Point of Initiation Method (12 = static)
  payload += emvField('01', '12');
  
  // Merchant Account Information
  const gui = emvField('00', 'BR.GOV.BCB.PIX');
  const chave = emvField('01', pixKey);
  payload += emvField('26', gui + chave);
  
  // Merchant Category Code
  payload += emvField('52', '0000');
  
  // Transaction Currency (986 = BRL)
  payload += emvField('53', '986');
  
  // Transaction Amount (if provided)
  if (amount > 0) {
    payload += emvField('54', amount.toFixed(2));
  }
  
  // Country Code
  payload += emvField('58', 'BR');
  
  // Merchant Name (max 25 chars)
  const name = receiverName.substring(0, 25).toUpperCase();
  payload += emvField('59', name);
  
  // Merchant City (max 15 chars)
  const city = receiverCity.substring(0, 15).toUpperCase();
  payload += emvField('60', city);
  
  // Additional Data Field Template (txid)
  if (txId) {
    const txIdField = emvField('05', txId.substring(0, 25));
    payload += emvField('62', txIdField);
  }
  
  // CRC16 placeholder
  payload += '6304';
  
  // Calculate CRC16
  const crc = crc16(payload);
  payload = payload.slice(0, -4) + emvField('63', crc);
  
  return payload;
}

// Generate QR Code as SVG using a simple implementation
function generateQRCodeSVG(data: string): string {
  // We'll use a simple base64 approach with an external service
  // In production, you'd want to use a proper QR library
  // For now, we return a data URL that can be used with an image generator API
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { workspaceId, amount, description, leadId, dueDate, source = 'manual', createdBy } = await req.json();

    if (!workspaceId || !amount || !dueDate) {
      return new Response(
        JSON.stringify({ error: "workspaceId, amount, and dueDate are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get PIX configuration for workspace (without is_active filter to provide specific errors)
    const { data: pixConfig, error: pixError } = await supabaseClient
      .from("pix_config")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (pixError) {
      console.error("Error fetching PIX config:", pixError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar configuração PIX", code: "PIX_FETCH_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pixConfig) {
      return new Response(
        JSON.stringify({ 
          error: "Nenhuma chave PIX foi configurada. Configure em Configurações → PIX.", 
          code: "PIX_NOT_CONFIGURED" 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pixConfig.is_active) {
      return new Response(
        JSON.stringify({ 
          error: "A configuração PIX está desativada. Ative em Configurações → PIX.", 
          code: "PIX_INACTIVE" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique transaction ID
    const txId = `AZ${Date.now().toString(36).toUpperCase()}`;

    // Generate PIX code
    const pixCode = generatePixCode(
      pixConfig.pix_key,
      pixConfig.receiver_name,
      pixConfig.receiver_city,
      parseFloat(amount),
      txId
    );

    // Generate QR Code URL using a public API
    // Using QR Server API which is free and reliable
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`;

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert({
        workspace_id: workspaceId,
        lead_id: leadId || null,
        amount: parseFloat(amount),
        description: description || null,
        due_date: dueDate,
        status: "pending",
        pix_code: pixCode,
        pix_qr_code: qrCodeUrl,
        source,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Failed to create invoice", details: invoiceError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoice,
        pixCode,
        qrCodeUrl,
        txId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-pix:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
