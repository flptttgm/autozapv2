import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[process-orphan-buffers] Starting orphan buffer check...');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Buscar buffers não processados e expirados há mais de 30 segundos
    // Isso garante que capturamos buffers que o process-message não conseguiu processar
    const cutoff = new Date(Date.now() - 30000).toISOString();
    
    const { data: orphanBuffers, error: fetchError } = await supabase
      .from('message_buffer')
      .select('id, chat_id, created_at, expires_at, workspace_id')
      .eq('is_processed', false)
      .lt('expires_at', cutoff)
      .order('expires_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('[process-orphan-buffers] Error fetching orphan buffers:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!orphanBuffers?.length) {
      console.log('[process-orphan-buffers] No orphan buffers found');
      return new Response(JSON.stringify({ processed: 0, message: 'No orphan buffers' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-orphan-buffers] Found ${orphanBuffers.length} orphan buffers to process`);

    const results = [];

    // Processar cada buffer órfão chamando process-message
    for (const buffer of orphanBuffers) {
      console.log(`[process-orphan-buffers] Processing orphan buffer ${buffer.id} for chat ${buffer.chat_id}, expired at ${buffer.expires_at}`);
      
      try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ chat_id: buffer.chat_id })
        });

        const responseData = await response.json().catch(() => ({}));
        
        results.push({
          buffer_id: buffer.id,
          chat_id: buffer.chat_id,
          status: response.ok ? 'triggered' : 'failed',
          response_status: responseData.status || 'unknown'
        });

        console.log(`[process-orphan-buffers] Triggered process-message for buffer ${buffer.id}: ${response.status} - ${JSON.stringify(responseData)}`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[process-orphan-buffers] Error triggering process-message for buffer ${buffer.id}:`, err);
        results.push({
          buffer_id: buffer.id,
          chat_id: buffer.chat_id,
          status: 'error',
          error: errorMessage
        });
      }
    }

    const successCount = results.filter(r => r.status === 'triggered').length;
    console.log(`[process-orphan-buffers] Completed. Triggered: ${successCount}/${orphanBuffers.length}`);

    return new Response(JSON.stringify({ 
      processed: orphanBuffers.length,
      triggered: successCount,
      results 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[process-orphan-buffers] Unexpected error:', err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
