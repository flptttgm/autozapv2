import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded IDs for the Appi Company demo account (gabriel@appicompany.com)
const DEMO_WORKSPACE_ID = '5fa32d2a-d6cf-42de-aa4c-d0964098ac8d';
const DEMO_TEMPLATE_ID = '3f56e859-9dcd-427f-9183-7a66fc6dc8f3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, messages = [] } = await req.json();
    
    console.log('[landing-ai-demo] Request:', { 
      messageLength: message?.length, 
      historyLength: messages.length 
    });

    if (!message || typeof message !== 'string' || message.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Invalid message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load AI settings from the demo template
    let rawSettings: any = {};
    let templateName = "Assistente Appi Company";

    const { data: templateData } = await supabase
      .from('custom_templates')
      .select('config, name')
      .eq('id', DEMO_TEMPLATE_ID)
      .maybeSingle();
    
    if (templateData?.config) {
      rawSettings = templateData.config;
      templateName = templateData.name || "Assistente Appi Company";
      console.log('[landing-ai-demo] Using template:', templateName);
    }

    // If no template settings, load workspace defaults
    if (!rawSettings.personality && !rawSettings.system_prompt) {
      const { data: aiSettingsData } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'ai_settings')
        .eq('workspace_id', DEMO_WORKSPACE_ID)
        .maybeSingle();
      
      rawSettings = aiSettingsData?.config_value || {};
      console.log('[landing-ai-demo] Using workspace default settings');
    }

    // Load knowledge base
    const { data: knowledgeItems } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('workspace_id', DEMO_WORKSPACE_ID)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // Default settings
    const defaultSettings = {
      personality: {
        tone: 70,
        verbosity: 50,
        proactivity: 60,
        assistant_name: "Assistente Appi Company",
        use_emojis: true,
      },
      system_prompt: `Você é o assistente virtual da Appi Company. Seja educado, profissional e prestativo.`,
      quick_replies: [],
    };

    const aiSettings = {
      personality: { ...defaultSettings.personality, ...rawSettings.personality },
      system_prompt: rawSettings.system_prompt || defaultSettings.system_prompt,
      quick_replies: rawSettings.quick_replies || defaultSettings.quick_replies,
    };

    // Build system prompt
    let systemPrompt = aiSettings.system_prompt;
    
    // Add personality traits
    const personality = aiSettings.personality;
    systemPrompt += `\n\nSeu nome é: ${personality.assistant_name || "Assistente"}`;
    
    if (personality.tone < 30) {
      systemPrompt += '\nMantenha um tom formal e profissional em todas as respostas.';
    } else if (personality.tone > 70) {
      systemPrompt += '\nSeja amigável e use linguagem informal, mas mantenha o respeito.';
    }
    
    if (personality.use_emojis) {
      systemPrompt += `
USO DE EMOJIS (COM MODERAÇÃO):
- Use NO MÁXIMO 1-2 emojis por mensagem completa
- Prefira emojis como marcadores visuais: 📅 (datas), 📍 (locais), ✅ (confirmações), 💰 (preços)
- EVITE emojis de expressão facial (😊🤗😁) excessivos
- NUNCA coloque emoji no final de cada frase
- Priorize clareza e profissionalismo`;
    } else {
      systemPrompt += '\nNão use emojis nas respostas.';
    }
    
    if (personality.verbosity < 30) {
      systemPrompt += '\nSeja extremamente conciso e direto nas respostas.';
    } else if (personality.verbosity > 70) {
      systemPrompt += '\nForneça respostas detalhadas e completas.';
    }
    
    if (personality.proactivity > 70) {
      systemPrompt += '\nSeja proativo: sugira próximos passos e antecipe necessidades.';
    }

    // Add knowledge base
    if (knowledgeItems && knowledgeItems.length > 0) {
      systemPrompt += "\n\n### Base de Conhecimento ###\n";
      knowledgeItems.forEach(item => {
        systemPrompt += `\n[${item.category}] ${item.title}:\n${item.content}\n`;
      });
    }

    // Add quick replies info
    if (aiSettings.quick_replies && aiSettings.quick_replies.length > 0) {
      systemPrompt += "\n\n### Respostas Rápidas Disponíveis ###\n";
      aiSettings.quick_replies.forEach((qr: any) => {
        systemPrompt += `- Gatilho: "${qr.trigger}" → Resposta: "${qr.response}"\n`;
      });
    }

    // Add demo context
    systemPrompt += "\n\n### Contexto de Demonstração ###";
    systemPrompt += "\nEsta é uma demonstração da plataforma Autozap. O visitante está testando a IA antes de criar uma conta.";
    systemPrompt += "\nSe perguntarem sobre o Autozap: é uma plataforma de atendimento automático via WhatsApp com IA personalizável.";
    systemPrompt += "\nEncoraje o visitante a criar uma conta gratuita para testar com seu próprio WhatsApp.";

    console.log('[landing-ai-demo] System prompt length:', systemPrompt.length);

    // Build conversation history (limit to last 5 messages to prevent abuse)
    const limitedMessages = messages.slice(-5);
    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...limitedMessages.map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: conversationMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[landing-ai-demo] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error('[landing-ai-demo] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
