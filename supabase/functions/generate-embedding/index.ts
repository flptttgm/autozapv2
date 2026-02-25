import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for Deno/Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

// Shutdown listener for debugging background task issues
addEventListener('beforeunload', (ev: Event) => {
  console.log('[generate-embedding] Runtime shutdown:', (ev as any).detail?.reason);
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a deterministic hash-based embedding as fallback
function generateHashEmbedding(text: string): number[] {
  const embedding: number[] = [];
  const normalizedText = text.toLowerCase().trim();
  
  // Use a simple but deterministic approach
  for (let i = 0; i < 384; i++) {
    // Create a hash for each dimension based on text characters
    let hash = 0;
    for (let j = 0; j < normalizedText.length; j++) {
      const char = normalizedText.charCodeAt(j);
      hash = ((hash << 5) - hash + char * (i + 1)) | 0;
    }
    // Convert to float between -1 and 1
    embedding.push(Math.sin(hash) * 0.5);
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    return embedding.map(v => v / magnitude);
  }
  return embedding;
}

// Generate semantic embedding using Lovable AI Gateway (384 dimensions)
// UPDATED: Removed hash-based fallback - fails explicitly for CRON retry
async function generateEmbedding(text: string, retryCount = 0): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const MAX_RETRIES = 3; // Increased from 2 to 3
  
  if (!LOVABLE_API_KEY) {
    console.error('[generate-embedding] LOVABLE_API_KEY not configured!');
    // CRITICAL: Return null instead of hash fallback - item will be marked as 'failed' for retry
    console.error('[generate-embedding] ❌ NO API KEY - returning null for retry');
    return null;
  }

  try {
    console.log('[generate-embedding] Generating embedding via Lovable AI Gateway... (attempt', retryCount + 1, ')');
    
    // Use a simpler prompt that's more likely to work
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
            content: `Generate a 384-dimensional semantic embedding vector for text analysis. Return ONLY the embedding array via the store_embedding function. Values must be floats between -1 and 1.`
          },
          { role: 'user', content: `Generate embedding for: "${text.substring(0, 2000)}"` }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'store_embedding',
            description: 'Store the 384-dimensional embedding',
            parameters: {
              type: 'object',
              properties: {
                embedding: {
                  type: 'array',
                  items: { type: 'number' },
                  description: '384 float values between -1 and 1'
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
      const errorText = await response.text();
      console.error('[generate-embedding] Lovable AI error:', response.status, errorText);
      
      if (retryCount < MAX_RETRIES) {
        console.log('[generate-embedding] Retrying... (attempt', retryCount + 2, 'of', MAX_RETRIES + 1, ')');
        await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay
        return generateEmbedding(text, retryCount + 1);
      }
      
      // CRITICAL: Return null instead of hash fallback - item will be marked as 'failed' for retry
      console.error('[generate-embedding] ❌ Max retries reached - returning null for CRON retry');
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[generate-embedding] No tool call in response, attempt', retryCount + 1);
      
      if (retryCount < MAX_RETRIES) {
        console.log('[generate-embedding] Retrying... (attempt', retryCount + 2, 'of', MAX_RETRIES + 1, ')');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      
      // CRITICAL: Return null instead of hash fallback
      console.error('[generate-embedding] ❌ No valid tool call - returning null for CRON retry');
      return null;
    }

    let args;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[generate-embedding] Failed to parse tool arguments:', parseError);
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      console.error('[generate-embedding] ❌ Parse error - returning null for CRON retry');
      return null;
    }
    
    if (!Array.isArray(args.embedding) || args.embedding.length === 0) {
      console.error('[generate-embedding] Invalid embedding format');
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return generateEmbedding(text, retryCount + 1);
      }
      console.error('[generate-embedding] ❌ Invalid format - returning null for CRON retry');
      return null;
    }

    // Validate and normalize the embedding
    let embedding = args.embedding;
    
    // If not exactly 384 dimensions, pad or truncate
    if (embedding.length < 384) {
      console.log(`[generate-embedding] Padding embedding from ${embedding.length} to 384`);
      while (embedding.length < 384) {
        embedding.push(0);
      }
    } else if (embedding.length > 384) {
      console.log(`[generate-embedding] Truncating embedding from ${embedding.length} to 384`);
      embedding = embedding.slice(0, 384);
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0));
    if (magnitude > 0) {
      embedding = embedding.map((v: number) => v / magnitude);
    }

    console.log('[generate-embedding] ✓ Generated semantic embedding via Lovable AI');
    return embedding;
  } catch (error) {
    console.error('[generate-embedding] Error calling Lovable AI:', error);
    
    if (retryCount < MAX_RETRIES) {
      console.log('[generate-embedding] Retrying after error... (attempt', retryCount + 2, 'of', MAX_RETRIES + 1, ')');
      await new Promise(resolve => setTimeout(resolve, 1500));
      return generateEmbedding(text, retryCount + 1);
    }
    
    // CRITICAL: Return null instead of hash fallback
    console.error('[generate-embedding] ❌ Exception after retries - returning null for CRON retry');
    return null;
  }
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

    const body = await req.json();
    const { knowledge_item_id, text, action, workspace_id } = body;
    
    console.log('[generate-embedding] Action:', action, 'workspace_id:', workspace_id);

    // Action: generate_for_item - Generate embedding for a specific knowledge base item
    // USES BACKGROUND PROCESSING with EdgeRuntime.waitUntil to avoid pg_net 5s timeout
    if (action === 'generate_for_item' && knowledge_item_id) {
      console.log('[generate-embedding] Starting background processing for:', knowledge_item_id);
      
      // 1. SYNC: Mark as processing BEFORE responding (< 50ms)
      const { error: markError } = await supabase
        .from('knowledge_base')
        .update({ embedding_status: 'processing' })
        .eq('id', knowledge_item_id);

      if (markError) {
        console.error('[generate-embedding] Failed to mark as processing:', markError);
        return new Response(JSON.stringify({ 
          error: 'Failed to start processing' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. SYNC: Fetch item data (< 50ms)
      const { data: item, error: itemError } = await supabase
        .from('knowledge_base')
        .select('id, title, content, keywords')
        .eq('id', knowledge_item_id)
        .single();

      if (itemError || !item) {
        console.error('[generate-embedding] Item not found:', itemError);
        await supabase
          .from('knowledge_base')
          .update({ embedding_status: 'failed' })
          .eq('id', knowledge_item_id);
        return new Response(JSON.stringify({ error: 'Item not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Prepare text BEFORE responding
      const keywordsStr = item.keywords?.join(' ') || '';
      const textToEmbed = `${item.title}\n${item.content}\n${keywordsStr}`;

      // 4. RESPOND IMMEDIATELY (< 100ms total) - This avoids pg_net 5s timeout!
      const immediateResponse = new Response(JSON.stringify({ 
        success: true, 
        message: 'Embedding generation started',
        item_id: knowledge_item_id,
        status: 'processing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

      // 5. BACKGROUND: Process embedding AFTER responding using waitUntil
      EdgeRuntime.waitUntil((async () => {
        const startTime = Date.now();
        try {
          console.log('[generate-embedding] Background: starting for', knowledge_item_id);
          
          const embedding = await generateEmbedding(textToEmbed);
          
          if (embedding) {
            const { error: updateError } = await supabase
              .from('knowledge_base')
              .update({ 
                embedding: `[${embedding.join(',')}]`,
                embedding_status: 'completed'
              })
              .eq('id', knowledge_item_id);
            
            if (updateError) {
              console.error('[generate-embedding] Background: save failed', knowledge_item_id, updateError);
              await supabase
                .from('knowledge_base')
                .update({ embedding_status: 'failed' })
                .eq('id', knowledge_item_id);
            } else {
              console.log('[generate-embedding] Background: ✓ completed', knowledge_item_id, 
                'in', Date.now() - startTime, 'ms');
            }
          } else {
            console.error('[generate-embedding] Background: generation failed', knowledge_item_id);
            await supabase
              .from('knowledge_base')
              .update({ embedding_status: 'failed' })
              .eq('id', knowledge_item_id);
          }
        } catch (bgError) {
          console.error('[generate-embedding] Background: exception', knowledge_item_id, bgError);
          try {
            await supabase
              .from('knowledge_base')
              .update({ embedding_status: 'failed' })
              .eq('id', knowledge_item_id);
          } catch (e) {
            console.error('[generate-embedding] Background: failed to mark as failed', e);
          }
        }
      })());

      return immediateResponse;
    }

    // Action: generate_for_query - Generate embedding for a search query (used by process-message)
    if (action === 'generate_for_query' && text) {
      console.log('[generate-embedding] Generating embedding for query, length:', text.length);
      
      const embedding = await generateEmbedding(text);
      
      if (!embedding) {
        return new Response(JSON.stringify({ error: 'Failed to generate embedding' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, embedding }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: migrate_all - Generate embeddings for all items without embeddings in a specific workspace
    if (action === 'migrate_all') {
      console.log('[generate-embedding] Starting migration for workspace:', workspace_id);
      
      let query = supabase
        .from('knowledge_base')
        .select('id, title, content, keywords')
        .or('embedding.is.null,embedding_status.eq.pending,embedding_status.eq.failed');
      
      if (workspace_id) {
        query = query.eq('workspace_id', workspace_id);
      }
      
      const { data: items, error: fetchError } = await query.limit(50);
      
      if (fetchError) {
        console.error('[generate-embedding] Error fetching items:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[generate-embedding] Migrating', items?.length || 0, 'items');
      
      let processed = 0;
      let failed = 0;
      
      for (const item of items || []) {
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
            console.log('[generate-embedding] ✓ Processed:', item.id, '-', item.title?.substring(0, 30));
          } else {
            failed++;
            console.error('[generate-embedding] ✗ Failed to update item:', item.id, updateError);
            await supabase
              .from('knowledge_base')
              .update({ embedding_status: 'failed' })
              .eq('id', item.id);
          }
        } else {
          failed++;
          console.error('[generate-embedding] ✗ Failed to generate embedding:', item.id);
          await supabase
            .from('knowledge_base')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id);
        }
        
        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('[generate-embedding] Migration complete:', { processed, failed });
      return new Response(JSON.stringify({ 
        success: true, 
        processed, 
        failed,
        remaining: (items?.length || 0) === 50
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: migrate_all_workspaces - Generate embeddings for ALL workspaces
    if (action === 'migrate_all_workspaces') {
      console.log('[generate-embedding] Starting migration for ALL workspaces');
      
      // Get all items that need processing
      const { data: items, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('id, title, content, keywords, workspace_id')
        .or('embedding.is.null,embedding_status.eq.pending,embedding_status.eq.failed')
        .eq('is_active', true)
        .limit(100);
      
      if (fetchError) {
        console.error('[generate-embedding] Error fetching items:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[generate-embedding] Processing', items?.length || 0, 'items across all workspaces');
      
      let processed = 0;
      let failed = 0;
      const workspaceStats: Record<string, { processed: number; failed: number }> = {};
      
      for (const item of items || []) {
        const wsId = item.workspace_id;
        if (!workspaceStats[wsId]) {
          workspaceStats[wsId] = { processed: 0, failed: 0 };
        }

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
            console.log('[generate-embedding] ✓ Processed:', item.id, '-', item.title?.substring(0, 30));
          } else {
            failed++;
            workspaceStats[wsId].failed++;
            await supabase
              .from('knowledge_base')
              .update({ embedding_status: 'failed' })
              .eq('id', item.id);
          }
        } else {
          failed++;
          workspaceStats[wsId].failed++;
          await supabase
            .from('knowledge_base')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id);
        }
        
        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('[generate-embedding] All workspaces migration complete:', { processed, failed, workspaceStats });
      return new Response(JSON.stringify({ 
        success: true, 
        processed, 
        failed,
        workspaces_processed: Object.keys(workspaceStats).length,
        workspace_stats: workspaceStats,
        remaining: (items?.length || 0) === 100
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: force_regenerate_all - Force regenerate ALL embeddings (including completed ones)
    if (action === 'force_regenerate_all') {
      console.log('[generate-embedding] FORCE regenerating ALL embeddings');
      
      // First, mark all as pending
      const { error: resetError } = await supabase
        .from('knowledge_base')
        .update({ embedding_status: 'pending' })
        .eq('is_active', true);
      
      if (resetError) {
        console.error('[generate-embedding] Error resetting status:', resetError);
      }

      // Get all items
      const { data: items, error: fetchError } = await supabase
        .from('knowledge_base')
        .select('id, title, content, keywords, workspace_id')
        .eq('is_active', true)
        .limit(100);
      
      if (fetchError) {
        console.error('[generate-embedding] Error fetching items:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[generate-embedding] Force regenerating', items?.length || 0, 'items');
      
      let processed = 0;
      let failed = 0;
      
      for (const item of items || []) {
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
            console.log('[generate-embedding] ✓ Regenerated:', item.id, '-', item.title?.substring(0, 30));
          } else {
            failed++;
            await supabase
              .from('knowledge_base')
              .update({ embedding_status: 'failed' })
              .eq('id', item.id);
          }
        } else {
          failed++;
          await supabase
            .from('knowledge_base')
            .update({ embedding_status: 'failed' })
            .eq('id', item.id);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('[generate-embedding] Force regeneration complete:', { processed, failed });
      return new Response(JSON.stringify({ 
        success: true, 
        processed, 
        failed,
        remaining: (items?.length || 0) === 100
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-embedding] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
