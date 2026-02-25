import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding via Lovable AI Gateway (384 dimensions)
async function generateEmbedding(text: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.error('[sync-qr] LOVABLE_API_KEY not configured!');
    return null;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { 
            role: 'system', 
            content: `You are a semantic embedding generator. Analyze text and generate a 384-dimensional embedding vector.
Values must be floats between -1 and 1. Similar texts should produce similar vectors.`
          },
          { role: 'user', content: `Generate embedding for:\n\n${text.substring(0, 4000)}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'store_embedding',
            parameters: {
              type: 'object',
              properties: {
                embedding: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Array of 384 floats between -1 and 1'
                }
              },
              required: ['embedding']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'store_embedding' } }
      }),
    });

    if (!response.ok) {
      console.error('[sync-qr] AI error:', response.status);
      return null;
    }

    const data = await response.json();
    const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{}');
    
    let embedding = args.embedding;
    if (!Array.isArray(embedding)) return null;

    // Pad/truncate to exactly 384 dimensions
    if (embedding.length < 384) {
      while (embedding.length < 384) embedding.push(0);
    } else if (embedding.length > 384) {
      embedding = embedding.slice(0, 384);
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (magnitude > 0) {
      embedding = embedding.map((v: number) => v / magnitude);
    }

    return embedding;
  } catch (error) {
    console.error('[sync-qr] Embedding error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-qr] ========== SYNC STARTED ==========');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const batchSize = 20;

    // CONCURRENCY SAFE: Atomic claim via RPC
    const { data: claimedItems, error: claimError } = await supabase
      .rpc('claim_pending_quick_reply_embeddings', { p_batch_size: batchSize });

    if (claimError) {
      console.error('[sync-qr] Claim error:', claimError);
      return new Response(JSON.stringify({ error: 'Failed to claim items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[sync-qr] Claimed', claimedItems?.length || 0, 'items atomically');

    if (!claimedItems?.length) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No items to process',
        processed: 0,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const item of claimedItems) {
      try {
        // CONSISTENCY: Use combined_text directly
        let textToEmbed = item.combined_text;

        // FALLBACK: If combined_text is empty, use trigger_text
        if (!textToEmbed || textToEmbed.trim() === '') {
          console.log('[sync-qr] Empty combined_text, trying trigger_text fallback');
          textToEmbed = item.trigger_text;
        }

        // If trigger_text is also empty, mark as failed
        if (!textToEmbed || textToEmbed.trim() === '') {
          console.warn('[sync-qr] Empty trigger_text, marking as failed:', item.id);
          await supabase
            .from('quick_reply_embeddings')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id);
          failed++;
          continue;
        }

        console.log('[sync-qr] Generating embedding:', textToEmbed.substring(0, 60) + '...');
        
        const embedding = await generateEmbedding(textToEmbed);
        
        if (embedding) {
          await supabase
            .from('quick_reply_embeddings')
            .update({ 
              embedding: `[${embedding.join(',')}]`,
              embedding_status: 'completed'
            })
            .eq('id', item.id);
          
          processed++;
          console.log('[sync-qr] ✓ Processed:', item.id);
        } else {
          await supabase
            .from('quick_reply_embeddings')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id);
          failed++;
        }
      } catch (itemError) {
        console.error('[sync-qr] Item error:', item.id, itemError);
        await supabase
          .from('quick_reply_embeddings')
          .update({ embedding_status: 'failed' })
          .eq('id', item.id);
        failed++;
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[sync-qr] ========== SYNC COMPLETE ==========');
    console.log('[sync-qr] Processed:', processed, 'Failed:', failed);

    return new Response(JSON.stringify({ 
      success: true, 
      processed, 
      failed,
      has_more: claimedItems.length >= batchSize,
      duration_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-qr] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
