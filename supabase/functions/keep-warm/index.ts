import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
};

const FUNCTIONS_TO_WARM = ['process-message', 'zapi-webhook'];
const TIMEOUT_MS = 10000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SEGURANÇA: Validar x-internal-key
  const internalKey = req.headers.get('x-internal-key');
  const expectedKey = Deno.env.get('INTERNAL_WARMUP_KEY');
  
  if (!expectedKey || internalKey !== expectedKey) {
    console.warn('[keep-warm] Acesso não autorizado - key inválida');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const startTime = Date.now();
  console.log('[keep-warm] Iniciando warm-up...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    return new Response(JSON.stringify({ error: 'SUPABASE_URL não configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Pingar todas as funções em paralelo com timeout
  const results = await Promise.all(
    FUNCTIONS_TO_WARM.map(async (fnName) => {
      const fnStart = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-warmup': 'true',
          },
          body: '{}',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return { function: fnName, status: response.status, ms: Date.now() - fnStart };
      } catch (err) {
        clearTimeout(timeout);
        const error = err as Error;
        return { 
          function: fnName, 
          error: error.name === 'AbortError' ? 'timeout' : error.message,
          ms: Date.now() - fnStart 
        };
      }
    })
  );

  const response = {
    success: true,
    total_ms: Date.now() - startTime,
    results,
  };

  console.log('[keep-warm] Completo:', JSON.stringify(response));

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
