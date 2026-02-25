import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de nomes de agentes para personas
const agentPersonaMapping: Record<string, { persona: string; type: string }> = {
  "assistente appi company": { persona: "Mariana", type: "support" },
  "assistente appi company 2": { persona: "Juliana", type: "support" },
  "assistente 1": { persona: "Fernanda", type: "general" },
  "as1 appi company": { persona: "Camila", type: "general" },
  "as 777": { persona: "Beatriz", type: "general" },
  "amanda atendente": { persona: "Amanda", type: "support" },
  "vitor": { persona: "Vitor", type: "general" },
};

// Avatares pré-definidos por tipo
const avatarPrompts: Record<string, string> = {
  sales: "professional sales representative, friendly smile",
  support: "customer service agent, helpful and approachable",
  scheduling: "appointment coordinator, organized and professional",
  financial: "financial advisor, trustworthy and professional",
  technical: "tech support specialist, knowledgeable",
  general: "friendly virtual assistant, professional appearance",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca TODOS os agentes de TODOS os workspaces que precisam de humanização
    const { data: agents, error: fetchError } = await supabase
      .from("custom_templates")
      .select("id, name, agent_persona_name, agent_type, avatar_url")
      .or("agent_persona_name.is.null,avatar_url.is.null");

    if (fetchError) {
      throw new Error(`Erro ao buscar agentes: ${fetchError.message}`);
    }

    console.log(`Encontrados ${agents?.length || 0} agentes para humanizar`);

    const results: Array<{ id: string; name: string; persona: string; status: string }> = [];

    for (const agent of agents || []) {
      try {
        // Encontra o mapeamento pelo nome (case insensitive)
        const nameLower = agent.name.toLowerCase().trim();
        const mapping = agentPersonaMapping[nameLower];
        
        // Define persona e tipo
        const personaName = agent.agent_persona_name || mapping?.persona || agent.name.split(" ")[0];
        const agentType = agent.agent_type || mapping?.type || "general";

        console.log(`Processando agente: ${agent.name} -> ${personaName} (${agentType})`);

        // Atualiza persona name e type
        await supabase
          .from("custom_templates")
          .update({
            agent_persona_name: personaName,
            agent_type: agentType,
          })
          .eq("id", agent.id);

        // Gera avatar se não tiver
        if (!agent.avatar_url) {
          console.log(`Gerando avatar para ${personaName}...`);
          
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (!LOVABLE_API_KEY) {
            throw new Error("LOVABLE_API_KEY não configurada");
          }

          const avatarContext = avatarPrompts[agentType] || avatarPrompts.general;
          const prompt = `Professional headshot portrait of a Brazilian ${personaName.endsWith("a") || personaName.endsWith("na") || personaName.endsWith("ia") ? "woman" : "man"} named ${personaName}, ${avatarContext}, corporate attire, neutral background, high quality photo, friendly expression, natural lighting`;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro ao gerar imagem: ${response.status} - ${errorText}`);
            results.push({ id: agent.id, name: agent.name, persona: personaName, status: "erro_avatar" });
            continue;
          }

          const data = await response.json();
          const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

          if (imageData && imageData.startsWith("data:image")) {
            // Extrai o base64 da data URL
            const base64Data = imageData.split(",")[1];
            const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

            // Upload para o storage
            const fileName = `avatars/${agent.id}.png`;
            const { error: uploadError } = await supabase.storage
              .from("media")
              .upload(fileName, imageBytes, {
                contentType: "image/png",
                upsert: true,
              });

            if (uploadError) {
              console.error(`Erro no upload: ${uploadError.message}`);
              results.push({ id: agent.id, name: agent.name, persona: personaName, status: "erro_upload" });
              continue;
            }

            // Obtém URL pública
            const { data: publicUrlData } = supabase.storage
              .from("media")
              .getPublicUrl(fileName);

            // Atualiza o avatar_url
            await supabase
              .from("custom_templates")
              .update({ avatar_url: publicUrlData.publicUrl })
              .eq("id", agent.id);

            results.push({ id: agent.id, name: agent.name, persona: personaName, status: "sucesso" });
          } else {
            results.push({ id: agent.id, name: agent.name, persona: personaName, status: "sem_imagem" });
          }
        } else {
          results.push({ id: agent.id, name: agent.name, persona: personaName, status: "já_tinha_avatar" });
        }

        // Delay entre gerações para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (agentError) {
        console.error(`Erro ao processar agente ${agent.name}:`, agentError);
        results.push({ id: agent.id, name: agent.name, persona: "erro", status: "erro" });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na função populate-agents:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
