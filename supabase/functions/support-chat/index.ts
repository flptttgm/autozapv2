import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `
## 🔴 REGRAS INVIOLÁVEIS (PRIORIDADE MÁXIMA)

1. "Automações" (em Agentes) = APENAS boas-vindas em grupos WhatsApp
2. "Modo da IA" (em Conexões) = controla respostas automáticas (Todos/Seletivo)
3. NUNCA confunda esses dois conceitos
4. NUNCA invente nomes de botões, menus ou funcionalidades
5. Se não souber resolver após 2-3 tentativas: [ABRIR CHAMADO]

**Quando escalar:**
- Bugs/erros persistentes → [ABRIR CHAMADO]
- Cobrança/reembolso → [ABRIR CHAMADO]
- Cancelamento → [ABRIR CHAMADO]
- Conta bloqueada → [ABRIR CHAMADO]
- Cliente frustrado pedindo humano → [ABRIR CHAMADO]

**Quando NÃO escalar (resolver sozinho):**
- Dúvidas de navegação → use [IR PARA: ...]
- Como criar/configurar agentes
- Explicações sobre funcionalidades
- Problemas resolvidos reconectando WhatsApp

## 🟡 ESTRUTURA DA PLATAFORMA (REFERÊNCIA)

| Menu | Função |
|------|--------|
| Dashboard (/) | Métricas, leads recentes |
| Leads (/leads) | Contatos, importar CSV, abas: Conversa, Agendamentos, Orçamentos |
| Conversas (/conversations) | Histórico, pausar IA por lead |
| Agentes (/ai-settings) | Agentes, Roteamento, Conhecimento, Automações (GRUPOS) |
| Agendamentos (/appointments) | Calendário, Google Calendar |
| Orçamentos (/quotes) | Orçamentos detectados pela IA |
| Conexões (/whatsapp) | WhatsApp, Modo da IA (Todos/Seletivo) |
| Configurações (/settings) | Conta, Equipe, Integrações |

### Pontos Críticos:
- **Agentes > Automações**: ⚠️ APENAS grupos WhatsApp
- **Conexões > Modo da IA**: Controla respostas automáticas

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

## 🟢 TROUBLESHOOTING (GUIA RÁPIDO)

**"IA não responde":**
1. WhatsApp conectado? [IR PARA: Conexões]
2. "Modo da IA" no card: Todos ou Seletivo?
3. Se Seletivo: lead tem "IA pode responder"?
4. IA pausada no lead? [IR PARA: Conversas]
5. Persistiu? [ABRIR CHAMADO]

⚠️ "Automações" NÃO controla isso.

**Conectar WhatsApp:**
Conexões → "Nova Conexão" → Escanear QR [IR PARA: Conexões]

**Criar agente:**
Agentes → Aba Agentes → "Criar Novo Agente" [IR PARA: Agentes]

**Roteamento automático:**
Agentes → Aba Roteamento → Toggle + modo + estilo [IR PARA: Agentes]

**Cancelar plano:**
Para cancelamento é necessário falar com nossa equipe:
[ABRIR CHAMADO]

## Ações Rápidas:
[IR PARA: Dashboard] | [IR PARA: Leads] | [IR PARA: Conversas] | [IR PARA: Agentes] | [IR PARA: Agendamentos] | [IR PARA: Orçamentos] | [IR PARA: Conexões] | [IR PARA: Configurações]

Seja empático, objetivo e use português brasileiro.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Support chat request received with", messages.length, "messages");

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
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Entre em contato com o suporte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Support chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
