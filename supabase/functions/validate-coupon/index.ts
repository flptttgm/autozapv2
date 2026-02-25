import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code, workspace_id, value } = await req.json();

    console.log(`[validate-coupon] Validating coupon: ${code} for workspace: ${workspace_id}, value: ${value}`);

    if (!code || !workspace_id) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Código do cupom e workspace são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find coupon by code (case insensitive)
    const { data: coupon, error } = await supabase
      .from("user_coupons")
      .select("*")
      .ilike("code", code.trim())
      .single();

    if (error || !coupon) {
      console.log(`[validate-coupon] Coupon not found: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "Cupom não encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if coupon is active
    if (coupon.is_active === false) {
      console.log(`[validate-coupon] Coupon is inactive: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "Este cupom está desativado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if coupon is already used (for single-use coupons)
    if (coupon.used && coupon.max_uses === 1) {
      console.log(`[validate-coupon] Coupon already used: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "Este cupom já foi utilizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max uses
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      console.log(`[validate-coupon] Coupon max uses reached: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "Este cupom atingiu o limite de usos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      console.log(`[validate-coupon] Coupon expired: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "Este cupom expirou" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check workspace ownership (if not universal)
    if (!coupon.is_universal && coupon.workspace_id && coupon.workspace_id !== workspace_id) {
      console.log(`[validate-coupon] Coupon not valid for this workspace: ${code}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "Este cupom não é válido para sua conta" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check minimum value
    if (coupon.min_value && value && value < coupon.min_value) {
      console.log(`[validate-coupon] Order value too low for coupon: ${code}, min: ${coupon.min_value}, value: ${value}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: `Valor mínimo para usar este cupom: R$ ${coupon.min_value.toLocaleString("pt-BR")}` 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-coupon] Coupon valid: ${code}, discount: ${coupon.discount_percent}%`);

    return new Response(
      JSON.stringify({
        valid: true,
        coupon_id: coupon.id,
        code: coupon.code,
        discount_percent: coupon.discount_percent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[validate-coupon] Error:", error);
    return new Response(
      JSON.stringify({ valid: false, reason: "Erro ao validar cupom" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
