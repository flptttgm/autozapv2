import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'critical';
  score: number;
  confidence: number;
  reason: string;
}

async function analyzeSentimentWithAI(messageContent: string): Promise<SentimentResult | null> {
  const apiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!apiKey) {
    console.error('[backfill-sentiment] GOOGLE_GENERATIVE_AI_API_KEY not configured');
    return null;
  }

  // Skip placeholder messages
  const placeholders = ['[Audio]', '[Imagem]', '[Vídeo]', '[Documento]', '[Arquivo]', '[Sticker]', '[Figurinha]'];
  if (placeholders.some(p => messageContent.includes(p))) {
    console.log('[backfill-sentiment] Skipping placeholder message');
    return null;
  }

  // Skip very short messages
  if (messageContent.trim().length < 3) {
    console.log('[backfill-sentiment] Message too short for analysis');
    return null;
  }

  const prompt = `Você é um especialista em análise de sentimento para contexto comercial/atendimento ao cliente.

Analise o sentimento da mensagem abaixo e classifique de acordo com:

COMPORTAMENTO COMERCIAL POSITIVO:
- Perguntas sobre preço/valor = POSITIVO (65-75)
- "Quanto custa?", "Qual o valor?" = POSITIVO (70)
- Pedido de orçamento/proposta = POSITIVO (75-80)
- Envio de imagem/documento = POSITIVO (60-65)
- "Quero saber mais", "Me interessei" = POSITIVO (65-75)
- Agradecimentos: "obrigado", "valeu" = POSITIVO (70-80)
- Expressões positivas: "perfeito", "legal", "ótimo" = POSITIVO (75-85)
- Confirmações de compra = MUITO POSITIVO (85-95)

NEUTRO (NÃO devem derrubar o score):
- Confirmações simples: "ok", "sim", "entendi" = NEUTRO ALTO (53-58)
- Mensagens curtas objetivas = NEUTRO (50-55)

NEGATIVO:
- Impaciência, demora = LEVEMENTE NEGATIVO (35-45)
- Reclamações = NEGATIVO (25-35)
- Frustração clara = NEGATIVO (15-25)
- Agressividade = CRÍTICO (0-15)

Responda APENAS com JSON válido:
{
  "sentiment": "positive" | "neutral" | "negative" | "critical",
  "score": <número de 0 a 100>,
  "confidence": <número de 0 a 1>,
  "reason": "<breve explicação em português>"
}

Mensagem do cliente:
"${messageContent}"`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('[backfill-sentiment] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[backfill-sentiment] No JSON found in response');
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as SentimentResult;
    return result;
  } catch (error) {
    console.error('[backfill-sentiment] Analysis error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============ ADMIN AUTHORIZATION CHECK ============
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error('[backfill-sentiment] No authorization header');
      return new Response(
        JSON.stringify({ error: "Não autorizado - token ausente" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[backfill-sentiment] Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is platform admin
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "platform_admin")
      .maybeSingle();

    if (!adminRole) {
      console.error('[backfill-sentiment] User is not platform admin:', user.id);
      return new Response(
        JSON.stringify({ error: "Acesso negado - apenas administradores da plataforma" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ============ END AUTHORIZATION CHECK ============

    console.log(`[backfill-sentiment] Admin ${user.email} authorized`);

    const { workspace_id, batch_size = 30, dry_run = false } = await req.json().catch(() => ({}));

    console.log(`[backfill-sentiment] Starting backfill - workspace: ${workspace_id || 'ALL'}, batch: ${batch_size}, dry_run: ${dry_run}`);

    // Find leads with inbound messages but missing sentiment history
    let query = supabase
      .from('leads')
      .select(`
        id,
        name,
        phone,
        workspace_id,
        sentiment_score
      `)
      .order('created_at', { ascending: false });

    if (workspace_id) {
      query = query.eq('workspace_id', workspace_id);
    }

    const { data: leads, error: leadsError } = await query.limit(batch_size * 2);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    console.log(`[backfill-sentiment] Found ${leads?.length || 0} leads to check`);

    const results = {
      processed: 0,
      analyzed: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ leadId: string; name: string; sentiment: string; score: number }>,
    };

    let processedCount = 0;

    for (const lead of leads || []) {
      if (processedCount >= batch_size) break;

      // Get latest inbound messages for this lead
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .eq('lead_id', lead.id)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(3);

      if (messagesError || !messages || messages.length === 0) {
        results.skipped++;
        continue;
      }

      // Check if we already have sentiment history for the latest message
      const { data: existingHistory } = await supabase
        .from('sentiment_history')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('message_id', messages[0].id)
        .maybeSingle();

      if (existingHistory) {
        results.skipped++;
        continue;
      }

      processedCount++;
      results.processed++;

      // Combine last 3 messages for context
      const combinedContent = messages
        .map(m => m.content)
        .reverse()
        .join('\n---\n');

      console.log(`[backfill-sentiment] Analyzing lead ${lead.name || lead.phone} (${lead.id})`);

      if (dry_run) {
        results.details.push({
          leadId: lead.id,
          name: lead.name || lead.phone,
          sentiment: 'dry_run',
          score: 0,
        });
        continue;
      }

      // Analyze sentiment
      const sentimentResult = await analyzeSentimentWithAI(combinedContent);

      if (!sentimentResult) {
        results.errors++;
        continue;
      }

      results.analyzed++;

      // Save to sentiment_history
      const { error: historyError } = await supabase
        .from('sentiment_history')
        .insert({
          lead_id: lead.id,
          message_id: messages[0].id,
          workspace_id: lead.workspace_id,
          sentiment: sentimentResult.sentiment,
          sentiment_score: sentimentResult.score,
        });

      if (historyError) {
        console.error(`[backfill-sentiment] Failed to save history for lead ${lead.id}:`, historyError);
        results.errors++;
        continue;
      }

      // Update lead's sentiment_score using weighted average (adaptive for short neutral messages)
      const currentScore = lead.sentiment_score ?? 50;
      
      // Short neutral messages have less impact
      const isShortNeutral = 
        sentimentResult.sentiment === 'neutral' && 
        sentimentResult.score >= 45 && 
        sentimentResult.score <= 58;
      
      const weight = isShortNeutral ? 0.15 : 0.3;
      const newScore = Math.round((currentScore * (1 - weight)) + (sentimentResult.score * weight));

      const { error: updateError } = await supabase
        .from('leads')
        .update({ sentiment_score: newScore })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`[backfill-sentiment] Failed to update lead ${lead.id}:`, updateError);
      }

      results.details.push({
        leadId: lead.id,
        name: lead.name || lead.phone,
        sentiment: sentimentResult.sentiment,
        score: sentimentResult.score,
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`[backfill-sentiment] Completed - processed: ${results.processed}, analyzed: ${results.analyzed}, skipped: ${results.skipped}, errors: ${results.errors}`);

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[backfill-sentiment] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});