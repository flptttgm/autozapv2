import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
