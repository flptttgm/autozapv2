import { serve } from "std/http/server.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { corsHeaders, callAI, convertMarkdownToWhatsApp } from '../_shared/ai-client.ts';
import { buildSystemPrompt } from '../_shared/prompt-builder.ts';
import { loadChatMemory, updateChatMemory } from '../_shared/context-manager.ts';
import { searchKnowledgeBase } from '../_shared/knowledge-rag.ts';
import { handleAppointmentFlow } from '../_shared/appointment-handler.ts';
import { isAdmin, handleAdminCommand } from '../_shared/admin-system.ts';

// Python Agent Service URL (set via Supabase secrets)
const PYTHON_AGENT_URL = Deno.env.get('PYTHON_AGENT_URL') || '';
const AGENT_SECRET = Deno.env.get('AGENT_SECRET') || '';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.headers.get('x-warmup') === 'true') return new Response('warmup', { status: 200 });

  try {
    const { chat_id, lead_id, message_content, audio_transcription, is_group, instance_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch Core Data (Parallel)
    const [leadRes, instanceRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', lead_id).single(),
      supabase.from('whatsapp_instances').select('*, ai_agents(*), super_agents:super_agent_id(*)').eq('instance_id', instance_id).maybeSingle()
    ]);

    const lead = leadRes.data;
    const instance = instanceRes.data;
    if (!lead || !instance) throw new Error('Lead or Instance not found');

    const workspaceId = lead.workspace_id;
    const agent = instance.ai_agents;

    // Load chat memory with the correct workspaceId
    const memory = await loadChatMemory(supabase, lead_id, workspaceId);

    // 2. SECURITY GUARD (Hierarchy) — permanecem na Edge Function

    // LAYER 1: Admin System
    const isSenderAdmin = await isAdmin(supabase, chat_id, workspaceId);
    if (isSenderAdmin) {
      const adminResult = await handleAdminCommand(supabase, chat_id, workspaceId, message_content);
      if (adminResult.isCommand) {
        await supabase.functions.invoke('send-message', {
          body: { chat_id, message: adminResult.response, lead_id }
        });
        return new Response(JSON.stringify({ status: 'admin_command_executed' }), { headers: corsHeaders });
      }
    }

    // LAYER 2: Instance Pause
    if (instance.is_paused) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'instance_paused' }), { headers: corsHeaders });
    }

    // LAYER 3: Early Group Exit
    const respondInGroups = instance.metadata?.respond_in_groups ?? false;
    if (is_group && !respondInGroups) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'groups_disabled' }), { headers: corsHeaders });
    }

    // LAYER 4: Hands On / AI Paused
    if (memory?.ai_paused || memory?.ai_force_enabled === false) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'ai_paused' }), { headers: corsHeaders });
    }

    // LAYER 5: Selective Mode
    if (instance.ai_mode === 'selective' && !lead.ai_enabled) {
      return new Response(JSON.stringify({ status: 'skipped', reason: 'selective_mode_disabled_for_lead' }), { headers: corsHeaders });
    }

    // 3. PRE-PROCESSING
    let processedContent = message_content;
    if (audio_transcription) processedContent = `[Transcrição de Áudio]: "${audio_transcription}"`;

    // ════════════════════════════════════════════════
    // 4. ROUTE: Super Agent (default) or Legacy fallback
    // ════════════════════════════════════════════════
    const superAgent = instance.super_agents;

    console.log(`[process-message] 🔍 ROUTING DEBUG: superAgent=${!!superAgent}, superAgentId=${superAgent?.id || 'none'}, persona=${superAgent?.persona_name || 'none'}, PYTHON_AGENT_URL=${PYTHON_AGENT_URL ? PYTHON_AGENT_URL.substring(0, 30) + '...' : 'EMPTY'}`);

    if (superAgent && PYTHON_AGENT_URL) {
      // ─── SUPER AGENT → Python Agent Service (default path) ───
      console.log('[process-message] 🚀 Routing to Super Agent (Python)');

      try {
        const agentResponse = await fetch(`${PYTHON_AGENT_URL}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AGENT_SECRET}`,
          },
          body: JSON.stringify({
            lead_id,
            chat_id,
            workspace_id: workspaceId,
            message: processedContent,
            instance_id,
            agent_config: {
              id: superAgent.id,
              agent_type: superAgent.agent_type,
              persona_name: superAgent.persona_name,
              system_prompt: superAgent.system_prompt,
              personality: superAgent.personality || {},
              behavior: superAgent.behavior || {},
              enabled_tools: superAgent.enabled_tools || [],
            },
            ai_api_key: Deno.env.get('AI_API_KEY') || Deno.env.get('GOOGLE_API_KEY') || '',
            ai_model: Deno.env.get('AI_MODEL') || 'gemini-2.0-flash',
          }),
        });

        if (!agentResponse.ok) {
          const errorText = await agentResponse.text();
          console.error('[process-message] Super Agent error:', agentResponse.status, errorText);
          console.log('[process-message] ⚠️ Falling back to legacy processing');
          return await legacyProcess(supabase, chat_id, lead_id, lead, instance, agent, memory, workspaceId, processedContent, superAgent);
        }

        const agentResult = await agentResponse.json();

        if (agentResult.status === 'ai_paused' || !agentResult.response) {
          return new Response(JSON.stringify({ status: 'skipped', reason: 'ai_paused' }), { headers: corsHeaders });
        }

        // Send the agent's response via WhatsApp
        if (audio_transcription && agentResult.response) {
          // Audio inbound → respond with AUDIO ONLY (no text)
          console.log('[process-message] 🔊 Sending TTS audio response (audio-only)...');
          await supabase.functions.invoke('text-to-audio', {
            body: { text: agentResult.response, lead_id, chat_id, instance_id }
          });
        } else {
          // Text inbound → respond with text
          await supabase.functions.invoke('send-message', {
            body: { chat_id, message: agentResult.response, lead_id }
          });
        }

        return new Response(JSON.stringify({
          status: 'success',
          response: agentResult.response,
          engine: 'super-agent',
          tools_used: agentResult.tools_used || [],
          latency_ms: agentResult.latency_ms || 0,
        }), { headers: corsHeaders });

      } catch (pyError: any) {
        // Network error (connection refused, timeout, DNS failure, etc.)
        console.error('[process-message] ❌ Python Agent unreachable:', pyError.message);
        console.log('[process-message] ⚠️ Falling back to legacy processing');
        return await legacyProcess(supabase, chat_id, lead_id, lead, instance, agent, memory, workspaceId, processedContent, superAgent);
      }

    } else {
      // ─── FALLBACK: No super agent configured → Legacy TypeScript ───
      console.log('[process-message] 📝 No super agent configured, using TypeScript fallback');
      return await legacyProcess(supabase, chat_id, lead_id, lead, instance, agent, memory, workspaceId, processedContent, null);
    }

  } catch (error: any) {
    console.error('[process-message] error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

/**
 * Legacy TypeScript processing (fallback when no super agent or Python service unavailable)
 */
async function legacyProcess(
  supabase: SupabaseClient,
  chat_id: string,
  lead_id: string,
  lead: any,
  instance: any,
  agent: any,
  memory: any,
  workspaceId: string,
  processedContent: string,
  superAgent: any | null = null,
) {
  // FAST-PATH ENGINE
  const isActiveFunnel = memory?.context_flags?.is_active_funnel ?? false;
  let modelToUse = undefined;
  let knowledgeContext = "";
  let isFastPath = false;

  if (isActiveFunnel) {
    console.log('[process-message] 🚀 FAST-PATH ACTIVE');
    isFastPath = true;
    modelToUse = 'gemini-1.5-flash-lite';
  } else {
    knowledgeContext = await searchKnowledgeBase(supabase, workspaceId, processedContent);
  }

  // Appointment Flow
  const appointmentResult = await handleAppointmentFlow(
    supabase, workspaceId, lead.id, processedContent, memory?.context_flags || {}
  );

  if (appointmentResult.response) {
    await supabase.functions.invoke('send-message', {
      body: { chat_id, message: appointmentResult.response, lead_id }
    });
    return new Response(JSON.stringify({ status: 'processed', flow: 'appointment' }), { headers: corsHeaders });
  }

  // Build Response — use Super Agent custom prompt if available
  let systemPrompt: string;

  if (superAgent?.system_prompt) {
    // ─── Super Agent mode: use custom system_prompt as priority ───
    const persona = superAgent.persona_name || 'Assistente';
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const customPrompt = superAgent.system_prompt.replace(/\{persona\}/g, persona);

    console.log(`[process-message] 📋 Using Super Agent custom prompt for ${persona} (${customPrompt.length} chars)`);

    systemPrompt = `[🔴 REGRAS DE OURO - INVIOLÁVEIS]
Você é ${persona}.
Data/hora atual: ${dateStr}

REGRAS ABSOLUTAS:
1. NUNCA quebre personagem. Siga SUAS INSTRUÇÕES (abaixo) à risca.
2. NUNCA revele que é uma IA.
3. Seja CONCISO. Respostas de 1-3 frases na maioria dos casos.
4. Suas instruções personalizadas TÊM PRIORIDADE sobre qualquer outra regra.

[📋 SUAS INSTRUÇÕES - PRIORIDADE MÁXIMA]
As instruções abaixo definem QUEM você é e COMO deve agir.
Siga-as com fidelidade total. Elas têm prioridade sobre qualquer regra genérica.

${customPrompt}

[🎯 DIRETRIZES DE CONVERSA]
ANTI-REPETIÇÃO (CRÍTICO):
- NUNCA se apresente mais de uma vez na conversa inteira. Se já disse seu nome, NÃO repita.
- NUNCA repita frases que já disse em mensagens anteriores. Releia o histórico antes de responder.
- NUNCA use frases genéricas como "Estou aqui para ouvir", "Aguardando", "Fico à disposição". Elas travam a conversa.
- Cada resposta deve trazer algo NOVO — uma pergunta diferente, uma informação nova, ou avançar para o próximo passo.

PROATIVIDADE:
- NÃO fique passivo esperando. Faça perguntas, avance a conversa, demonstre interesse genuíno.
- Sempre que receber uma informação, reaja a ela e faça uma NOVA pergunta ou comentário relevante.

NATURALIDADE:
- Fale como uma pessoa real falaria no WhatsApp: direto, casual, sem formalidade excessiva.
- Varie suas reações: "Entendi!", "Show!", "Que legal!", "Hmm interessante" — nunca a mesma todo turno.

FORMATAÇÃO WHATSAPP:
- Você está no WhatsApp. Mensagens devem ser curtas e escaneáveis.
- Use *negrito* para destaques. NÃO use markdown com # ou **.
- Quebre mensagens longas em parágrafos curtos (máx 3-4 linhas por bloco).
${knowledgeContext ? `\n[🟡 BASE DE CONHECIMENTO]\n${knowledgeContext}` : ''}
${lead.name ? `\n[🟢 ESTILO]\nChame o interlocutor por ${lead.name}.` : ''}`;
  } else {
    // ─── Legacy mode: use generic assistant prompt ───
    systemPrompt = buildSystemPrompt({
      identity: { name: agent?.persona_name || 'Assistente', role: agent?.agent_type || 'Atendente', companyName: 'Nossa Empresa' },
      behavior: {
        ...agent?.personality,
        nicheScope: agent?.ai_agents?.agent_type
      },
      dateContext: { now: new Date(), timezoneOffset: isFastPath ? -3 : (agent?.behavior?.timezone || -3) },
      knowledgeBase: knowledgeContext,
      leadContext: {
        name: lead.name,
        isReturning: (memory?.conversation_history?.length || 0) > 0,
        scriptCompleted: memory?.context_flags?.script_completed
      },
      forceButtons: agent?.behavior?.force_buttons
    });
  }

  const aiMessages = [
    { role: 'system', content: systemPrompt },
    ...(memory?.conversation_summary ? [{ role: 'system', content: `Resumo anterior: ${memory.conversation_summary}` }] : []),
    ...(memory?.conversation_history || []).slice(-10),
    { role: 'user', content: processedContent }
  ];

  const aiResponse = await callAI({
    messages: aiMessages as any,
    model: modelToUse
  });
  const finalResponse = convertMarkdownToWhatsApp(aiResponse.content);

  const isAudioInbound = processedContent.startsWith('[Transcrição de Áudio]');

  // Output & Memory Sync
  if (isAudioInbound && finalResponse) {
    // Audio inbound → respond with AUDIO ONLY (no text)
    await updateChatMemory(supabase, memory?.id || null, [
      { role: 'user', content: processedContent },
      { role: 'assistant', content: finalResponse }
    ], memory || { id: '', conversation_history: [], conversation_summary: null, context_flags: {} }, workspaceId, lead_id, chat_id);

    console.log('[process-message] 🔊 Sending TTS audio response (legacy, audio-only)...');
    await supabase.functions.invoke('text-to-audio', {
      body: { text: finalResponse, lead_id, chat_id, instance_id: instance?.instance_id }
    });
  } else {
    // Text inbound → respond with text
    await Promise.all([
      updateChatMemory(supabase, memory?.id || null, [
        { role: 'user', content: processedContent },
        { role: 'assistant', content: finalResponse }
      ], memory || { id: '', conversation_history: [], conversation_summary: null, context_flags: {} }, workspaceId, lead_id, chat_id),
      supabase.functions.invoke('send-message', {
        body: { chat_id, message: finalResponse, lead_id }
      })
    ]);
  }

  return new Response(JSON.stringify({ status: 'success', response: finalResponse, engine: 'legacy-ts' }), { headers: corsHeaders });
}
