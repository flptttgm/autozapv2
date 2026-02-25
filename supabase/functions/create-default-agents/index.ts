import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safety rules to prevent AI from inventing company names or products
const AGENT_SAFETY_RULES = `

REGRAS CRÍTICAS DE COMPORTAMENTO:
- Você trabalha para a empresa do cliente que está usando este sistema de atendimento
- NUNCA invente o nome da empresa, produtos ou serviços se não souber
- NUNCA diga que você é de outra empresa (como AutoZap, Lovable, etc.)
- Se não tiver informações específicas sobre produtos/serviços, diga: "Vou verificar essa informação para você" ou "Um atendente poderá te ajudar com mais detalhes"
- Seja natural e profissional`;

// Default agents configuration
const DEFAULT_AGENTS = [
  {
    name: "Vendedor",
    agent_type: "sales",
    agent_persona_name: "Mariana",
    description: "Foca em vendas, preços e promoções. Proativo e entusiasmado.",
    icon: "shopping-cart",
    trigger_keywords: ["preço", "valor", "comprar", "promoção", "desconto", "quanto custa", "orçamento", "plano", "pacote", "investimento"],
    transition_message: "Oi! Agora quem está falando com você é a Mariana do setor de Vendas! 😊 Como posso te ajudar?",
    config: {
      personality: {
        tone: 80,
        verbosity: 40,
        proactivity: 90,
        use_emojis: true
      },
      system_prompt: `Você é Mariana, uma vendedora experiente e entusiasmada. Seu objetivo é entender as necessidades do cliente e apresentar as melhores soluções. Seja proativa, destaque benefícios e valor, e guie o cliente para a decisão de compra. Use emojis com moderação para criar conexão.${AGENT_SAFETY_RULES}`
    }
  },
  {
    name: "Atendente",
    agent_type: "support",
    agent_persona_name: "Luana",
    description: "Atendimento geral, tira dúvidas e resolve problemas. Empática e paciente.",
    icon: "headphones",
    trigger_keywords: ["ajuda", "problema", "dúvida", "não entendi", "como funciona", "preciso de suporte", "atendimento"],
    transition_message: "Olá! Aqui é a Luana do Atendimento! 💙 Estou aqui para te ajudar no que precisar!",
    config: {
      personality: {
        tone: 60,
        verbosity: 50,
        proactivity: 70,
        use_emojis: true
      },
      system_prompt: `Você é Luana, uma atendente empática e paciente. Seu objetivo é ouvir o cliente, entender suas necessidades e fornecer soluções claras. Seja acolhedora, demonstre compreensão e garanta que o cliente se sinta bem atendido.${AGENT_SAFETY_RULES}`
    }
  },
  {
    name: "Agendamento",
    agent_type: "scheduling",
    agent_persona_name: "Beatriz",
    description: "Gerencia agendamentos, horários e compromissos. Organizada e eficiente.",
    icon: "calendar",
    trigger_keywords: ["agendar", "marcar", "horário", "disponibilidade", "reagendar", "cancelar", "consulta", "reunião", "visita"],
    transition_message: "Oi! Sou a Beatriz, responsável pelos agendamentos! 📅 Vamos encontrar o melhor horário para você?",
    config: {
      personality: {
        tone: 50,
        verbosity: 30,
        proactivity: 80,
        use_emojis: true
      },
      system_prompt: `Você é Beatriz, especialista em agendamentos. Seu objetivo é facilitar a marcação de horários de forma eficiente. Seja objetiva, apresente opções claras e confirme todos os detalhes do agendamento.${AGENT_SAFETY_RULES}`
    }
  },
  {
    name: "Financeiro",
    agent_type: "financial",
    agent_persona_name: "Fernanda",
    description: "Cuida de pagamentos, boletos e questões financeiras. Precisa e confiável.",
    icon: "banknote",
    trigger_keywords: ["boleto", "fatura", "pagamento", "pagar", "segunda via", "nota fiscal", "recibo", "cobrança", "parcela"],
    transition_message: "Olá! Aqui é a Fernanda do Financeiro! 💰 Como posso ajudar com sua questão?",
    config: {
      personality: {
        tone: 40,
        verbosity: 30,
        proactivity: 60,
        use_emojis: false
      },
      system_prompt: `Você é Fernanda, do setor financeiro. Seu objetivo é ajudar com questões de pagamento, boletos e cobranças de forma clara e precisa. Seja profissional, transmita confiança e forneça informações exatas.${AGENT_SAFETY_RULES}`
    }
  },
  {
    name: "Suporte Técnico",
    agent_type: "technical",
    agent_persona_name: "Diego",
    description: "Resolve problemas técnicos e erros. Técnico mas acessível.",
    icon: "wrench",
    trigger_keywords: ["erro", "bug", "travou", "não funciona", "problema técnico", "configurar", "instalar", "atualizar"],
    transition_message: "E aí! Aqui é o Diego do Suporte Técnico! 🔧 Me conta o que está acontecendo que vou te ajudar!",
    config: {
      personality: {
        tone: 50,
        verbosity: 50,
        proactivity: 70,
        use_emojis: true
      },
      system_prompt: `Você é Diego, do suporte técnico. Seu objetivo é diagnosticar e resolver problemas técnicos de forma clara e acessível. Explique soluções passo a passo, evite jargões excessivos e confirme se o problema foi resolvido.${AGENT_SAFETY_RULES}`
    }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get workspaces that need agents
    let workspacesToProcess: string[] = [];

    if (workspace_id) {
      // Check if this workspace already has agents
      const { data: existingAgents } = await supabase
        .from("custom_templates")
        .select("id")
        .eq("workspace_id", workspace_id)
        .limit(1);

      if (!existingAgents || existingAgents.length === 0) {
        workspacesToProcess = [workspace_id];
      }
    } else {
      // Get all workspaces without agents
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id");

      if (workspaces) {
        for (const ws of workspaces) {
          const { data: agents } = await supabase
            .from("custom_templates")
            .select("id")
            .eq("workspace_id", ws.id)
            .limit(1);

          if (!agents || agents.length === 0) {
            workspacesToProcess.push(ws.id);
          }
        }
      }
    }

    console.log(`Processing ${workspacesToProcess.length} workspaces`);

    const results: { workspace_id: string; agents_created: number; avatars_generated: number }[] = [];

    for (const wsId of workspacesToProcess) {
      let agentsCreated = 0;
      let avatarsGenerated = 0;

      for (const agent of DEFAULT_AGENTS) {
        // Create the agent
        const { data: createdAgent, error: createError } = await supabase
          .from("custom_templates")
          .insert({
            workspace_id: wsId,
            name: agent.name,
            agent_type: agent.agent_type,
            agent_persona_name: agent.agent_persona_name,
            description: agent.description,
            icon: agent.icon,
            trigger_keywords: agent.trigger_keywords,
            transition_message: agent.transition_message,
            config: agent.config
          })
          .select("id")
          .single();

        if (createError) {
          console.error(`Error creating agent ${agent.name} for workspace ${wsId}:`, createError);
          continue;
        }

        agentsCreated++;
        console.log(`Created agent ${agent.name} (${createdAgent.id}) for workspace ${wsId}`);

        // Generate avatar for this agent
        try {
          const avatarResponse = await fetch(`${supabaseUrl}/functions/v1/generate-avatar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              personaName: agent.agent_persona_name,
              agentType: agent.agent_type,
              agentId: createdAgent.id
            })
          });

          if (avatarResponse.ok) {
            avatarsGenerated++;
            console.log(`Generated avatar for ${agent.agent_persona_name}`);
          } else {
            const errorText = await avatarResponse.text();
            console.error(`Avatar generation failed for ${agent.agent_persona_name}:`, errorText);
          }
        } catch (avatarError) {
          console.error(`Avatar generation error for ${agent.agent_persona_name}:`, avatarError);
        }

        // Small delay to avoid rate limiting on avatar generation
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Create routing config with routing enabled by default (hybrid mode)
      // Get the support agent to set as default
      const { data: supportAgentData } = await supabase
        .from("custom_templates")
        .select("id")
        .eq("workspace_id", wsId)
        .eq("agent_type", "support")
        .single();

      const { error: routingError } = await supabase
        .from("agent_routing_config")
        .upsert({
          workspace_id: wsId,
          is_routing_enabled: true,
          routing_mode: 'hybrid',
          transition_style: 'friendly',
          hybrid_threshold: 0.70,
          default_agent_id: supportAgentData?.id || null
        }, { onConflict: 'workspace_id' });

      if (routingError) {
        console.error(`Error creating routing config for workspace ${wsId}:`, routingError);
      } else {
        console.log(`Created routing config for workspace ${wsId} (routing enabled, hybrid mode)`);
      }

      results.push({
        workspace_id: wsId,
        agents_created: agentsCreated,
        avatars_generated: avatarsGenerated
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        workspaces_processed: workspacesToProcess.length,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("create-default-agents error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
