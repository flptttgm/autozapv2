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
    // 4. ROUTE: Engine Fork
    // ════════════════════════════════════════════════
    const engine = instance.agent_engine || 'legacy';
    const superAgent = instance.super_agents;

    if (engine === 'super_agent' && superAgent && PYTHON_AGENT_URL) {
      // ─── SUPER AGENT → Python Agent Service ───
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
          return await legacyProcess(supabase, chat_id, lead_id, lead, instance, agent, memory, workspaceId, processedContent);
        }

        const agentResult = await agentResponse.json();

        if (agentResult.status === 'ai_paused' || !agentResult.response) {
          return new Response(JSON.stringify({ status: 'skipped', reason: 'ai_paused' }), { headers: corsHeaders });
        }

        // Send the agent's response via WhatsApp
        await supabase.functions.invoke('send-message', {
          body: { chat_id, message: agentResult.response, lead_id }
        });

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
        return await legacyProcess(supabase, chat_id, lead_id, lead, instance, agent, memory, workspaceId, processedContent);
      }

    } else {
      // ─── PURE LEGACY: Original TypeScript processing ───
      console.log('[process-message] 📝 Using legacy TypeScript processing');
      return await legacyProcess(supabase, chat_id, lead_id, lead, instance, agent, memory, workspaceId, processedContent);
    }

  } catch (error: any) {
    console.error('[process-message] error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

/**
 * Legacy TypeScript processing (original logic preserved as fallback)
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

  // Build Response
  const systemPrompt = buildSystemPrompt({
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

  // Output & Memory Sync
  await Promise.all([
    updateChatMemory(supabase, memory?.id || crypto.randomUUID(), [
      { role: 'user', content: processedContent },
      { role: 'assistant', content: finalResponse }
    ], memory || { id: '', conversation_history: [], conversation_summary: null, context_flags: {} }),
    supabase.functions.invoke('send-message', {
      body: { chat_id, message: finalResponse, lead_id }
    })
  ]);

  return new Response(JSON.stringify({ status: 'success', response: finalResponse, engine: 'legacy-ts' }), { headers: corsHeaders });
}
