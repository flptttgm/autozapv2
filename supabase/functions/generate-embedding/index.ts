import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate embedding using OpenAI text-embedding-3-small (1536 dimensions).
 * Uses AI_API_KEY (OpenAI key) from Supabase secrets.
 */
async function generateEmbedding(text: string, retryCount = 0): Promise<number[] | null> {
  const API_KEY = Deno.env.get('AI_API_KEY');
  const MAX_RETRIES = 3;

  if (!API_KEY) {
    console.error('[generate-embedding] AI_API_KEY not configured!');
    return null;
  }

  try {
    console.log('[generate-embedding] Calling OpenAI text-embedding-3-small (attempt', retryCount + 1, ')');

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-embedding] OpenAI error:', response.status, errorText);

      if (retryCount < MAX_RETRIES && response.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return generateEmbedding(text, retryCount + 1);
      }
      return null;
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.error('[generate-embedding] Invalid response format');
      return null;
    }

    console.log('[generate-embedding] ✓ Generated', embedding.length, 'dimensions');
    return embedding;
  } catch (error) {
    console.error('[generate-embedding] Exception:', error);

    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return generateEmbedding(text, retryCount + 1);
    }
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

    // =========================================================
    // Action: generate_for_item — single knowledge base item
    // =========================================================
    if (action === 'generate_for_item' && knowledge_item_id) {
      console.log('[generate-embedding] Background processing for:', knowledge_item_id);

      const { error: markError } = await supabase
        .from('knowledge_base')
        .update({ embedding_status: 'processing' })
        .eq('id', knowledge_item_id);

      if (markError) {
        return new Response(JSON.stringify({ error: 'Failed to start processing' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: item, error: itemError } = await supabase
        .from('knowledge_base')
        .select('id, title, content, keywords')
        .eq('id', knowledge_item_id)
        .single();

      if (itemError || !item) {
        await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', knowledge_item_id);
        return new Response(JSON.stringify({ error: 'Item not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const keywordsStr = item.keywords?.join(' ') || '';
      const textToEmbed = `${item.title}\n${item.content}\n${keywordsStr}`;

      const immediateResponse = new Response(JSON.stringify({
        success: true, message: 'Embedding generation started',
        item_id: knowledge_item_id, status: 'processing'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      EdgeRuntime.waitUntil((async () => {
        const startTime = Date.now();
        try {
          const embedding = await generateEmbedding(textToEmbed);
          if (embedding) {
            const { error: updateError } = await supabase
              .from('knowledge_base')
              .update({ embedding: `[${embedding.join(',')}]`, embedding_status: 'completed' })
              .eq('id', knowledge_item_id);

            if (updateError) {
              console.error('[generate-embedding] Save failed:', knowledge_item_id, updateError);
              await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', knowledge_item_id);
            } else {
              console.log('[generate-embedding] ✓ Completed', knowledge_item_id, 'in', Date.now() - startTime, 'ms');
            }
          } else {
            await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', knowledge_item_id);
          }
        } catch (bgError) {
          console.error('[generate-embedding] Background error:', bgError);
          try { await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', knowledge_item_id); } catch (_) { }
        }
      })());

      return immediateResponse;
    }

    // =========================================================
    // Action: generate_for_query — embedding for search queries
    // =========================================================
    if (action === 'generate_for_query' && text) {
      const embedding = await generateEmbedding(text);
      if (!embedding) {
        return new Response(JSON.stringify({ error: 'Failed to generate embedding' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, embedding }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================
    // Action: migrate_all — batch process pending items
    // =========================================================
    if (action === 'migrate_all') {
      let query = supabase
        .from('knowledge_base')
        .select('id, title, content, keywords')
        .or('embedding.is.null,embedding_status.eq.pending,embedding_status.eq.failed')
        .eq('is_active', true);

      if (workspace_id) query = query.eq('workspace_id', workspace_id);
      const { data: items, error: fetchError } = await query.limit(50);

      if (fetchError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let processed = 0, failed = 0;
      for (const item of items || []) {
        await supabase.from('knowledge_base').update({ embedding_status: 'processing' }).eq('id', item.id);
        const keywordsStr = item.keywords?.join(' ') || '';
        const embedding = await generateEmbedding(`${item.title}\n${item.content}\n${keywordsStr}`);

        if (embedding) {
          const { error } = await supabase.from('knowledge_base')
            .update({ embedding: `[${embedding.join(',')}]`, embedding_status: 'completed' })
            .eq('id', item.id);
          if (!error) processed++; else {
            failed++;
            await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', item.id);
          }
        } else {
          failed++;
          await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', item.id);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return new Response(JSON.stringify({ success: true, processed, failed, remaining: (items?.length || 0) === 50 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // =========================================================
    // Action: force_regenerate_all
    // =========================================================
    if (action === 'force_regenerate_all') {
      await supabase.from('knowledge_base').update({ embedding_status: 'pending' }).eq('is_active', true);
      const { data: items, error: fetchError } = await supabase
        .from('knowledge_base').select('id, title, content, keywords').eq('is_active', true).limit(100);

      if (fetchError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let processed = 0, failed = 0;
      for (const item of items || []) {
        await supabase.from('knowledge_base').update({ embedding_status: 'processing' }).eq('id', item.id);
        const keywordsStr = item.keywords?.join(' ') || '';
        const embedding = await generateEmbedding(`${item.title}\n${item.content}\n${keywordsStr}`);

        if (embedding) {
          const { error } = await supabase.from('knowledge_base')
            .update({ embedding: `[${embedding.join(',')}]`, embedding_status: 'completed' })
            .eq('id', item.id);
          if (!error) processed++; else {
            failed++;
            await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', item.id);
          }
        } else {
          failed++;
          await supabase.from('knowledge_base').update({ embedding_status: 'failed' }).eq('id', item.id);
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return new Response(JSON.stringify({ success: true, processed, failed, remaining: (items?.length || 0) === 100 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-embedding] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
