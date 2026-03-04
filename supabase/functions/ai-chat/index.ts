import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Model whitelist with provider routing
// All use AI_API_KEY — OpenAI key for GPT models, Google API key for Gemini models
const MODEL_CONFIG: Record<string, { provider: 'google' | 'openai'; modelId: string; label: string }> = {
  'gemini-2.5-flash': { provider: 'google', modelId: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  'gemini-2.5-pro': { provider: 'google', modelId: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  'gpt-4o-mini': { provider: 'openai', modelId: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  'gpt-4o': { provider: 'openai', modelId: 'gpt-4o', label: 'GPT-4o' },
};

const DEFAULT_MODEL = 'gpt-4o-mini';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Auth validation failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`AI chat request from user: ${user.id}`);

    const { messages, model: requestedModel } = await req.json();

    // Resolve model configuration
    const modelKey = requestedModel && MODEL_CONFIG[requestedModel] ? requestedModel : DEFAULT_MODEL;
    const modelConfig = MODEL_CONFIG[modelKey];

    // API key — AI_API_KEY is our main key (OpenAI)
    const aiApiKey = Deno.env.get("AI_API_KEY") || '';
    if (!aiApiKey) {
      throw new Error("AI_API_KEY is not configured");
    }

    console.log(`Using model: ${modelConfig.label} (${modelConfig.modelId}) via ${modelConfig.provider}`);

    const systemPrompt = `
## 🔴 REGRAS INVIOLÁVEIS (PRIORIDADE MÁXIMA)

1. "Automações" (em Agentes) = APENAS boas-vindas em grupos WhatsApp
2. "Modo da IA" (em Conexões) = controla se IA responde todas ou apenas leads selecionados
3. NUNCA invente nomes de botões, menus ou funcionalidades
4. NUNCA confunda "Automações" com controle de respostas da IA
5. Se não souber a localização exata, admita: "Vou verificar para você"

## 🟡 ESTRUTURA DA PLATAFORMA (REFERÊNCIA)

| Menu | Rota | Função Principal |
|------|------|-----------------|
| Dashboard | /dashboard | Métricas, leads recentes, orçamentos |
| Leads | /leads | Lista de contatos, importar CSV, filtros |
| Conversas | /conversations | Histórico de mensagens, pausar IA por lead |
| Agentes | /ai-settings | Criar agentes, roteamento, conhecimento, automações (grupos) |
| Agendamentos | /appointments | Calendário, integração Google Calendar |
| Orçamentos | /quotes | Orçamentos detectados pela IA |
| Conexões | /whatsapp | Conectar WhatsApp, Modo da IA (Todos/Seletivo) |
| Configurações | /settings | Conta, equipe, integrações, calendário |
| Estatísticas | /statistics | Gráficos de desempenho |

### Detalhes Importantes:
- **Agentes > Aba Agentes**: Criar agentes (Vendas, Suporte, Agendamentos, Financeiro, Técnico)
- **Agentes > Aba Roteamento**: Troca automática de agentes (palavras-chave ou IA)
- **Agentes > Aba Conhecimento**: Base de conhecimento compartilhada
- **Agentes > Aba Automações**: ⚠️ APENAS para boas-vindas em GRUPOS
- **Conexões > Card da conexão > Modo da IA**: "Todos" ou "Seletivo"

## 🔵 TECNOLOGIA (REFERÊNCIA INTERNA)

**Base de Conhecimento com RAG:**
O AutoZap utiliza RAG (Retrieval-Augmented Generation) para respostas precisas:
- Base de Conhecimento: itens cadastrados em Agentes > Aba Conhecimento
- Busca Semântica: vetores de 384 dimensões encontram conteúdo relevante
- Threshold: 0.4 de similaridade mínima para considerar match
- Fallback: itens de alta prioridade são usados se não houver match semântico

**Quando perguntarem sobre tecnologia da IA:**
- Explicar que usamos RAG, não GPT genérico
- A IA responde baseada no que o usuário configurou na Base de Conhecimento
- Isso evita "alucinações" e respostas inventadas
- Quanto mais completa a Base de Conhecimento, melhores as respostas

## 🟢 COMPORTAMENTO E FORMATO

**Ações Rápidas:**
[IR PARA: Dashboard] | [IR PARA: Leads] | [IR PARA: Conversas] | [IR PARA: Agentes] | [IR PARA: Agendamentos] | [IR PARA: Orçamentos] | [IR PARA: Conexões] | [IR PARA: Configurações]

**FAQs Rápidas:**
- Conectar WhatsApp: Conexões → "Nova Conexão" → Escanear QR [IR PARA: Conexões]
- Criar agente: Agentes → Aba Agentes → "Criar Novo Agente" [IR PARA: Agentes]
- IA não responde: Verificar Conexões → Modo da IA + verificar se IA está pausada no lead
- Importar contatos: Leads → "Importar" (CSV) [IR PARA: Leads]
- Adicionar conhecimento: Agentes → Aba Conhecimento [IR PARA: Agentes]
- Convidar equipe: Configurações → Aba Equipe [IR PARA: Configurações]

**Troubleshooting "IA não responde":**
1. Verificar se WhatsApp está conectado em [IR PARA: Conexões]
2. Verificar "Modo da IA" no card da conexão (Todos vs Seletivo)
3. Se Seletivo: verificar se lead tem "IA pode responder" ativado
4. Verificar se IA não está pausada no lead específico

⚠️ "Automações" em Agentes é para GRUPOS, não controla respostas da IA.

Responda em português brasileiro, seja objetivo e use nomes exatos de menus/botões.`;

    // ─── Route to the correct API ───────────────────
    let response: Response;

    if (modelConfig.provider === 'google') {
      // Google Gemini — direct streaming via generateContent with streamGenerateContent
      const geminiMessages = [];

      // System instruction handled separately in Gemini API
      const contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.modelId}:streamGenerateContent?alt=sse&key=${aiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", response.status, errorText);

        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Transform Gemini SSE stream to OpenAI-compatible SSE stream
      // so the frontend parser works unchanged
      const geminiStream = response.body!;
      const transformedStream = new ReadableStream({
        async start(controller) {
          const reader = geminiStream.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              let newlineIndex;
              while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                let line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);

                if (line.endsWith('\r')) line = line.slice(0, -1);
                if (!line.startsWith('data: ')) continue;

                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(jsonStr);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    // Emit in OpenAI SSE format
                    const openaiChunk = JSON.stringify({
                      choices: [{ delta: { content: text } }]
                    });
                    controller.enqueue(new TextEncoder().encode(`data: ${openaiChunk}\n\n`));
                  }
                } catch { /* skip malformed */ }
              }
            }

            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        }
      });

      return new Response(transformedStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else {
      // OpenAI — standard streaming
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelConfig.modelId,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
