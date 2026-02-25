import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate semantic embedding using Lovable AI Gateway (384 dimensions)
// UPDATED: Increased retries and timeout, removed hash fallback
async function generateEmbedding(text: string, retryCount = 0): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const MAX_RETRIES = 3; // Increased from 2 to 3
  
  if (!LOVABLE_API_KEY) {
    console.error('[sync-embeddings] LOVABLE_API_KEY not configured!');
    return null;
  }

  try {
    console.log('[sync-embeddings] Generating embedding via Lovable AI Gateway... (attempt', retryCount + 1, 'of', MAX_RETRIES + 1, ')');
    
    // Use Lovable AI with tool calling to extract structured embedding
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite', // Fast and cheap for embeddings
        messages: [
          { 
            role: 'system', 
            content: `You are a semantic embedding generator. Your task is to analyze text and generate a 384-dimensional embedding vector that captures its semantic meaning.

Instructions:
1. Analyze the semantic meaning, topics, entities, and context of the input text
2. Generate a 384-dimensional vector where each dimension represents a semantic feature
3. Values must be floats between -1 and 1
4. Similar texts should produce similar vectors (high cosine similarity)
5. Use the store_embedding function to return your result

The embedding should capture:
- Main topics and themes
- Named entities (people, places, products, prices)
- Sentiment and tone
- Action items or requests
- Domain-specific terminology`
          },
          { role: 'user', content: `Generate a semantic embedding for this text:\n\n${text.substring(0, 4000)}` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'store_embedding',
            description: 'Store the generated 384-dimensional semantic embedding vector',
            parameters: {
              type: 'object',
              properties: {
                embedding: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Array of exactly 384 float values between -1 and 1 representing semantic features'
                }
              },
              required: ['embedding'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'store_embedding' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sync-embeddings] Lovable AI error:', response.status, errorText);
      
      if (retryCount < MAX_RETRIES) {
        console.log('[sync-embeddings] Retrying...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[sync-embeddings] No tool call in response');
      
      if (retryCount < MAX_RETRIES) {
        console.log('[sync-embeddings] Retrying...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      
      return null;
    }

    let args;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[sync-embeddings] Failed to parse arguments:', parseError);
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      
      return null;
    }
    
    if (!Array.isArray(args.embedding) || args.embedding.length === 0) {
      console.error('[sync-embeddings] Invalid embedding format');
      
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      
      return null;
    }
    
    // Validate and normalize the embedding
    let embedding = args.embedding;
    
    // If not exactly 384 dimensions, pad or truncate
    if (embedding.length < 384) {
      console.log(`[sync-embeddings] Padding embedding from ${embedding.length} to 384`);
      while (embedding.length < 384) {
        embedding.push(0);
      }
    } else if (embedding.length > 384) {
      console.log(`[sync-embeddings] Truncating embedding from ${embedding.length} to 384`);
      embedding = embedding.slice(0, 384);
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (magnitude > 0) {
      embedding = embedding.map((v: number) => v / magnitude);
    }

    console.log('[sync-embeddings] ✓ Generated semantic embedding via Lovable AI');
    return embedding;
  } catch (error) {
    console.error('[sync-embeddings] Error calling Lovable AI:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[sync-embeddings] ========== SYNC STARTED ==========');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse optional parameters
    let batchSize = 20; // Reduced batch size due to AI API calls
    
    try {
      const body = await req.json();
      batchSize = body.batch_size || 20;
    } catch {
      // Use defaults if no body
    }

    console.log('[sync-embeddings] Config:', { batchSize });

    // Get items that need embeddings (pending, null, or stuck in processing)
    const { data: pendingItems, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('id, title, content, keywords, workspace_id, embedding_status')
      .or('embedding.is.null,embedding_status.eq.pending,embedding_status.eq.processing')
      .eq('is_active', true)
      .limit(batchSize);

    if (fetchError) {
      console.error('[sync-embeddings] Error fetching pending items:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Also get failed items that should be retried
    const { data: failedItems, error: failedError } = await supabase
      .from('knowledge_base')
      .select('id, title, content, keywords, workspace_id, embedding_status')
      .eq('embedding_status', 'failed')
      .eq('is_active', true)
      .limit(Math.floor(batchSize / 2)); // Use half the batch for retries

    if (failedError) {
      console.error('[sync-embeddings] Error fetching failed items:', failedError);
    }

    const allItems = [...(pendingItems || []), ...(failedItems || [])];
    console.log('[sync-embeddings] Found', allItems.length, 'items to process');
    console.log('[sync-embeddings] - Pending:', pendingItems?.length || 0);
    console.log('[sync-embeddings] - Failed (retry):', failedItems?.length || 0);

    if (allItems.length === 0) {
      console.log('[sync-embeddings] No items to process');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No items to sync',
        processed: 0,
        failed: 0,
        duration_ms: Date.now() - startTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let failed = 0;
    const workspaceStats: Record<string, { processed: number; failed: number }> = {};

    for (const item of allItems) {
      const wsId = item.workspace_id;
      if (!workspaceStats[wsId]) {
        workspaceStats[wsId] = { processed: 0, failed: 0 };
      }

      try {
        // Mark as processing
        await supabase
          .from('knowledge_base')
          .update({ embedding_status: 'processing' })
          .eq('id', item.id);

        const keywordsStr = item.keywords?.join(' ') || '';
        const textToEmbed = `${item.title}\n${item.content}\n${keywordsStr}`;
        
        const embedding = await generateEmbedding(textToEmbed);
        
        if (embedding) {
          const { error: updateError } = await supabase
            .from('knowledge_base')
            .update({ 
              embedding: `[${embedding.join(',')}]`,
              embedding_status: 'completed'
            })
            .eq('id', item.id);
          
          if (!updateError) {
            processed++;
            workspaceStats[wsId].processed++;
            console.log('[sync-embeddings] ✓ Processed item:', item.id, 'title:', item.title?.substring(0, 30));
          } else {
            failed++;
            workspaceStats[wsId].failed++;
            console.error('[sync-embeddings] ✗ Failed to save embedding:', item.id, updateError);
            await supabase
              .from('knowledge_base')
              .update({ embedding_status: 'failed' })
              .eq('id', item.id);
          }
        } else {
          failed++;
          workspaceStats[wsId].failed++;
          console.error('[sync-embeddings] ✗ Failed to generate embedding:', item.id);
          await supabase
            .from('knowledge_base')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id);
        }
      } catch (itemError) {
        failed++;
        workspaceStats[wsId].failed++;
        console.error('[sync-embeddings] ✗ Exception processing item:', item.id, itemError);
        await supabase
          .from('knowledge_base')
          .update({ embedding_status: 'failed' })
          .eq('id', item.id);
      }
      
      // Delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Get final stats
    const { data: finalStats } = await supabase.rpc('get_embedding_stats');

    const duration = Date.now() - startTime;
    console.log('[sync-embeddings] ========== SYNC COMPLETE ==========');
    console.log('[sync-embeddings] Results:', { processed, failed, duration_ms: duration });
    console.log('[sync-embeddings] Workspace stats:', workspaceStats);

    return new Response(JSON.stringify({ 
      success: true, 
      processed, 
      failed,
      workspaces_affected: Object.keys(workspaceStats).length,
      workspace_stats: workspaceStats,
      global_stats: finalStats?.[0] || null,
      has_more: allItems.length >= batchSize,
      duration_ms: duration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-embeddings] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
