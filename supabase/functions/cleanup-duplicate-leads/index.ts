import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normaliza números de telefone brasileiros para formato com 9 dígitos
 * Exemplo: 554884239506 → 5548984239506 (adiciona o 9 após o DDD)
 */
const normalizeBrazilianPhone = (phone: string): string => {
  if (!phone) return phone;
  
  const digits = phone.replace(/\D/g, '');
  
  // Se não começa com 55 (Brasil), retorna como está
  if (!digits.startsWith('55')) return digits;
  
  // Se tem menos de 12 dígitos, não é válido
  if (digits.length < 12) return digits;
  
  // Se já tem 13 dígitos (55 + DDD + 9 dígitos), está correto
  if (digits.length === 13) return digits;
  
  const ddd = digits.substring(2, 4);
  const number = digits.substring(4);
  
  // Se tem 8 dígitos e NÃO começa com 9, adiciona o 9
  if (number.length === 8 && !number.startsWith('9')) {
    return `55${ddd}9${number}`;
  }
  
  return digits;
};

/**
 * Unifica chat_ids duplicados para o mesmo lead.
 * Prioriza o chat_id com mais mensagens ou o mais recente.
 * Formato @lid é preferido sobre @s.whatsapp.net
 */
const cleanupDuplicateChatIds = async (
  supabase: any, 
  workspaceId: string, 
  dryRun: boolean
): Promise<{
  leadsProcessed: number;
  chatIdsUnified: number;
  messagesUpdated: number;
  details: Array<{
    leadId: string;
    leadName: string | null;
    primaryChatId: string;
    mergedChatIds: string[];
    messagesMoved: number;
  }>;
}> => {
  console.log(`[cleanup-chat-ids] Starting chat_id cleanup for workspace: ${workspaceId}`);
  
  const result = {
    leadsProcessed: 0,
    chatIdsUnified: 0,
    messagesUpdated: 0,
    details: [] as Array<{
      leadId: string;
      leadName: string | null;
      primaryChatId: string;
      mergedChatIds: string[];
      messagesMoved: number;
    }>
  };

  // Buscar todos os leads que têm mais de um chat_id
  let leadsWithMultipleChatIds = null;
  try {
    const rpcResult = await supabase.rpc(
      'get_leads_with_multiple_chat_ids',
      { p_workspace_id: workspaceId }
    );
    leadsWithMultipleChatIds = rpcResult.data;
  } catch (e) {
    console.log('[cleanup-chat-ids] RPC not available:', e);
  }

  // Fallback: buscar manualmente se RPC não existir
  let leadsToProcess: Array<{ lead_id: string; chat_ids: string[]; message_counts: number[] }> = [];
  
  if (!leadsWithMultipleChatIds) {
    console.log('[cleanup-chat-ids] RPC not available, using manual query');
    
    // Buscar leads do workspace
    const { data: leads } = await supabase
      .from('leads')
      .select('id, name')
      .eq('workspace_id', workspaceId);
    
    if (!leads) return result;

    for (const lead of leads) {
      // Buscar todos os chat_ids distintos para este lead
      const { data: chatIdData } = await supabase
        .from('messages')
        .select('chat_id')
        .eq('lead_id', lead.id);
      
      if (!chatIdData) continue;
      
      // Agrupar por chat_id e contar mensagens
      const chatIdCounts = new Map<string, number>();
      for (const msg of chatIdData) {
        const count = chatIdCounts.get(msg.chat_id) || 0;
        chatIdCounts.set(msg.chat_id, count + 1);
      }
      
      if (chatIdCounts.size > 1) {
        leadsToProcess.push({
          lead_id: lead.id,
          chat_ids: Array.from(chatIdCounts.keys()),
          message_counts: Array.from(chatIdCounts.values())
        });
      }
    }
  } else {
    leadsToProcess = leadsWithMultipleChatIds;
  }

  console.log(`[cleanup-chat-ids] Found ${leadsToProcess.length} leads with multiple chat_ids`);

  for (const leadData of leadsToProcess) {
    const { lead_id } = leadData;
    
    // Buscar detalhes do lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name, phone')
      .eq('id', lead_id)
      .single();
    
    if (!lead) continue;

    // Buscar todos os chat_ids com contagem de mensagens
    const { data: chatIdStats } = await supabase
      .from('messages')
      .select('chat_id')
      .eq('lead_id', lead_id);
    
    if (!chatIdStats) continue;

    // Agrupar e ordenar por quantidade de mensagens
    const chatIdCounts = new Map<string, number>();
    for (const msg of chatIdStats) {
      const count = chatIdCounts.get(msg.chat_id) || 0;
      chatIdCounts.set(msg.chat_id, count + 1);
    }

    const sortedChatIds = Array.from(chatIdCounts.entries())
      .sort((a, b) => {
        // Primeiro: mais mensagens
        if (b[1] !== a[1]) return b[1] - a[1];
        // Segundo: preferir @lid sobre @s.whatsapp.net
        const aIsLid = a[0].includes('@lid');
        const bIsLid = b[0].includes('@lid');
        if (aIsLid && !bIsLid) return -1;
        if (!aIsLid && bIsLid) return 1;
        return 0;
      });

    if (sortedChatIds.length <= 1) continue;

    const primaryChatId = sortedChatIds[0][0];
    const chatIdsToMerge = sortedChatIds.slice(1).map(([chatId]) => chatId);
    
    console.log(`[cleanup-chat-ids] Lead ${lead.name || lead_id}: primary=${primaryChatId}, merging=${chatIdsToMerge.join(', ')}`);

    let messagesMoved = 0;

    if (!dryRun) {
      for (const oldChatId of chatIdsToMerge) {
        // Atualizar mensagens para usar o chat_id principal
        const { data: updatedMessages, error: updateError } = await supabase
          .from('messages')
          .update({ chat_id: primaryChatId })
          .eq('lead_id', lead_id)
          .eq('chat_id', oldChatId)
          .select('id');
        
        if (updateError) {
          console.error(`[cleanup-chat-ids] Error updating messages:`, updateError);
        } else {
          messagesMoved += updatedMessages?.length || 0;
        }

        // Atualizar message_buffer
        await supabase
          .from('message_buffer')
          .update({ chat_id: primaryChatId })
          .eq('lead_id', lead_id)
          .eq('chat_id', oldChatId);

        // Unificar chat_memory: manter o registro do chat principal, deletar os outros
        const { data: primaryMemory } = await supabase
          .from('chat_memory')
          .select('*')
          .eq('lead_id', lead_id)
          .eq('chat_id', primaryChatId)
          .maybeSingle();

        const { data: oldMemory } = await supabase
          .from('chat_memory')
          .select('*')
          .eq('lead_id', lead_id)
          .eq('chat_id', oldChatId)
          .maybeSingle();

        if (oldMemory) {
          if (primaryMemory) {
            // Merge: manter configurações importantes do antigo se o principal não tiver
            const mergedHistory = [
              ...(primaryMemory.conversation_history || []),
              ...(oldMemory.conversation_history || [])
            ].slice(-50); // Manter últimas 50 mensagens

            await supabase
              .from('chat_memory')
              .update({
                conversation_history: mergedHistory,
                ai_paused: primaryMemory.ai_paused || oldMemory.ai_paused,
                context_summary: primaryMemory.context_summary || oldMemory.context_summary,
                updated_at: new Date().toISOString()
              })
              .eq('id', primaryMemory.id);

            // Deletar o registro antigo
            await supabase
              .from('chat_memory')
              .delete()
              .eq('id', oldMemory.id);
          } else {
            // Atualizar o antigo para usar o novo chat_id
            await supabase
              .from('chat_memory')
              .update({ chat_id: primaryChatId })
              .eq('id', oldMemory.id);
          }
        }

        // Atualizar quotes
        await supabase
          .from('quotes')
          .update({ chat_id: primaryChatId })
          .eq('lead_id', lead_id)
          .eq('chat_id', oldChatId);
      }

      // Atualizar metadata do lead com o chat_id principal
      const { data: currentLead } = await supabase
        .from('leads')
        .select('metadata')
        .eq('id', lead_id)
        .single();

      const currentMetadata = (currentLead?.metadata as any) || {};
      await supabase
        .from('leads')
        .update({
          metadata: {
            ...currentMetadata,
            chatId: primaryChatId,
            mergedChatIds: chatIdsToMerge
          }
        })
        .eq('id', lead_id);
    } else {
      // Dry run: calcular mensagens que seriam movidas
      for (const oldChatId of chatIdsToMerge) {
        const count = chatIdCounts.get(oldChatId) || 0;
        messagesMoved += count;
      }
    }

    result.leadsProcessed++;
    result.chatIdsUnified += chatIdsToMerge.length;
    result.messagesUpdated += messagesMoved;
    result.details.push({
      leadId: lead_id,
      leadName: lead.name,
      primaryChatId,
      mergedChatIds: chatIdsToMerge,
      messagesMoved
    });
  }

  console.log(`[cleanup-chat-ids] Completed. Leads: ${result.leadsProcessed}, ChatIds unified: ${result.chatIdsUnified}, Messages: ${result.messagesUpdated}`);
  return result;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Verificar autorização (requer admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar se é platform_admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .maybeSingle();

    if (!userRole) {
      return new Response(JSON.stringify({ error: 'Admin privileges required' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { workspace_id, dry_run = true, cleanup_chat_ids = false } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[cleanup-duplicates] Starting cleanup for workspace: ${workspace_id}, dry_run: ${dry_run}, cleanup_chat_ids: ${cleanup_chat_ids}`);

    // =============================================
    // Parte 1: Limpeza de Chat IDs duplicados
    // =============================================
    let chatIdCleanupResult = null;
    if (cleanup_chat_ids) {
      chatIdCleanupResult = await cleanupDuplicateChatIds(supabase, workspace_id, dry_run);
    }

    // =============================================
    // Parte 2: Limpeza de Leads duplicados (existente)
    // =============================================

    // Buscar todos os leads do workspace
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, name, created_at, updated_at')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: true });

    if (leadsError) {
      console.error('[cleanup-duplicates] Error fetching leads:', leadsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch leads', details: leadsError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ 
        dry_run,
        duplicates_found: 0, 
        duplicates: [], 
        chat_id_cleanup: chatIdCleanupResult,
        message: 'No leads found in workspace' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[cleanup-duplicates] Found ${leads.length} leads to analyze`);

    // Agrupar leads por número normalizado
    const phoneGroups = new Map<string, typeof leads>();
    
    for (const lead of leads) {
      if (!lead.phone) continue;
      
      const normalized = normalizeBrazilianPhone(lead.phone);
      if (!phoneGroups.has(normalized)) {
        phoneGroups.set(normalized, []);
      }
      phoneGroups.get(normalized)!.push(lead);
    }

    // Identificar e processar duplicados
    const duplicates: Array<{
      normalizedPhone: string;
      keepLead: { id: string; phone: string; name: string | null; messageCount: number };
      removeLeads: Array<{ id: string; phone: string; name: string | null; messageCount: number }>;
      totalMessagesMoved: number;
      action: string;
    }> = [];

    let totalMerged = 0;
    let totalDeleted = 0;

    for (const [normalized, groupLeads] of phoneGroups) {
      if (groupLeads.length <= 1) continue; // Não é duplicado

      console.log(`[cleanup-duplicates] Found duplicate group for ${normalized}: ${groupLeads.length} leads`);

      // Buscar contagem de mensagens para cada lead
      const leadsWithCounts = await Promise.all(
        groupLeads.map(async (lead) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', lead.id);
          return { ...lead, messageCount: count || 0 };
        })
      );

      // Ordenar: mais mensagens primeiro, depois mais antigo
      leadsWithCounts.sort((a, b) => {
        if (b.messageCount !== a.messageCount) {
          return b.messageCount - a.messageCount; // Mais mensagens primeiro
        }
        return new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime(); // Mais antigo
      });

      const keepLead = leadsWithCounts[0];
      const removeLeads = leadsWithCounts.slice(1);
      let totalMessagesMoved = 0;

      for (const removeLead of removeLeads) {
        totalMessagesMoved += removeLead.messageCount;
        
        if (!dry_run) {
          console.log(`[cleanup-duplicates] Merging lead ${removeLead.id} into ${keepLead.id}`);
          
          // Mover mensagens do lead duplicado para o principal
          const { error: msgError } = await supabase
            .from('messages')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (msgError) {
            console.error(`[cleanup-duplicates] Error moving messages:`, msgError);
          }

          // Mover appointments
          const { error: aptError } = await supabase
            .from('appointments')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (aptError) {
            console.error(`[cleanup-duplicates] Error moving appointments:`, aptError);
          }

          // Mover quotes
          const { error: quoteError } = await supabase
            .from('quotes')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (quoteError) {
            console.error(`[cleanup-duplicates] Error moving quotes:`, quoteError);
          }

          // Mover lead_tag_assignments
          const { error: tagError } = await supabase
            .from('lead_tag_assignments')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (tagError) {
            console.error(`[cleanup-duplicates] Error moving tag assignments:`, tagError);
          }

          // Mover chat_memory
          const { error: memoryError } = await supabase
            .from('chat_memory')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (memoryError) {
            console.error(`[cleanup-duplicates] Error moving chat_memory:`, memoryError);
          }

          // Mover sentiment_history
          const { error: sentimentError } = await supabase
            .from('sentiment_history')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (sentimentError) {
            console.error(`[cleanup-duplicates] Error moving sentiment_history:`, sentimentError);
          }

          // Mover ai_feedback
          const { error: feedbackError } = await supabase
            .from('ai_feedback')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (feedbackError) {
            console.error(`[cleanup-duplicates] Error moving ai_feedback:`, feedbackError);
          }

          // Mover sentiment_alerts
          const { error: alertError } = await supabase
            .from('sentiment_alerts')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (alertError) {
            console.error(`[cleanup-duplicates] Error moving sentiment_alerts:`, alertError);
          }

          // Mover calendar_integrations
          const { error: calError } = await supabase
            .from('calendar_integrations')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (calError) {
            console.error(`[cleanup-duplicates] Error moving calendar_integrations:`, calError);
          }

          // Mover message_buffer
          const { error: bufferError } = await supabase
            .from('message_buffer')
            .update({ lead_id: keepLead.id })
            .eq('lead_id', removeLead.id);
          
          if (bufferError) {
            console.error(`[cleanup-duplicates] Error moving message_buffer:`, bufferError);
          }

          // Deletar lead duplicado
          const { error: deleteError } = await supabase
            .from('leads')
            .delete()
            .eq('id', removeLead.id);
          
          if (deleteError) {
            console.error(`[cleanup-duplicates] Error deleting lead:`, deleteError);
          } else {
            totalDeleted++;
          }
        }
      }

      // Atualizar telefone do lead mantido para formato normalizado
      if (!dry_run && keepLead.phone !== normalized) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ phone: normalized })
          .eq('id', keepLead.id);
        
        if (updateError) {
          console.error(`[cleanup-duplicates] Error updating lead phone:`, updateError);
        }
      }

      totalMerged += removeLeads.length;

      duplicates.push({
        normalizedPhone: normalized,
        keepLead: { 
          id: keepLead.id, 
          phone: keepLead.phone, 
          name: keepLead.name, 
          messageCount: keepLead.messageCount 
        },
        removeLeads: removeLeads.map(l => ({ 
          id: l.id, 
          phone: l.phone, 
          name: l.name, 
          messageCount: l.messageCount 
        })),
        totalMessagesMoved,
        action: dry_run ? 'would_merge' : 'merged'
      });
    }

    // =============================================
    // Parte 3: Limpeza de Chat IDs após merge de leads
    // =============================================
    // Executar limpeza de chat_ids automaticamente após merge de leads
    // para garantir que as mensagens unificadas também tenham chat_id único
    if (!dry_run && totalMerged > 0 && !cleanup_chat_ids) {
      console.log('[cleanup-duplicates] Auto-running chat_id cleanup after lead merge');
      chatIdCleanupResult = await cleanupDuplicateChatIds(supabase, workspace_id, false);
    }

    // Log da operação
    await supabase.from('platform_logs').insert({
      action: dry_run ? 'duplicate_leads_scan' : 'duplicate_leads_cleanup',
      entity_type: 'leads',
      entity_id: workspace_id,
      user_id: user.id,
      details: {
        workspace_id,
        duplicates_found: duplicates.length,
        leads_merged: totalMerged,
        leads_deleted: totalDeleted,
        chat_id_cleanup: chatIdCleanupResult,
        dry_run,
        executed_by: user.email
      }
    });

    console.log(`[cleanup-duplicates] Completed. Duplicates: ${duplicates.length}, Merged: ${totalMerged}, Deleted: ${totalDeleted}`);

    return new Response(JSON.stringify({
      dry_run,
      duplicates_found: duplicates.length,
      leads_merged: dry_run ? 0 : totalMerged,
      leads_deleted: dry_run ? 0 : totalDeleted,
      duplicates,
      chat_id_cleanup: chatIdCleanupResult,
      message: dry_run 
        ? `Simulação concluída. Encontrados ${duplicates.length} grupos de duplicados (${totalMerged} leads a mesclar). Execute com dry_run=false para aplicar.`
        : `Limpeza concluída! ${totalMerged} leads mesclados, ${totalDeleted} leads removidos.${chatIdCleanupResult ? ` Chat IDs unificados: ${chatIdCleanupResult.chatIdsUnified}` : ''}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[cleanup-duplicates] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
