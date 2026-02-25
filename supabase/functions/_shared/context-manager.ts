// ============================================
// Context Manager - Conversation History & Summary Management
// ============================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { callAI } from './ai-client.ts';

export interface ChatMemory {
    id: string;
    conversation_history: any[];
    conversation_summary: string | null;
    context_flags: any;
    ai_paused?: boolean;
    ai_force_enabled?: boolean;
}

export async function loadChatMemory(
    supabase: SupabaseClient,
    leadId: string,
    workspaceId: string
): Promise<ChatMemory | null> {
    const { data, error } = await supabase
        .from('chat_memory')
        .select('id, conversation_history, conversation_summary, context_flags')
        .eq('lead_id', leadId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

    if (error) {
        console.error('Error loading chat memory:', error);
        return null;
    }
    return data;
}

export async function updateChatMemory(
    supabase: SupabaseClient,
    memoryId: string,
    newMessages: any[], // [UserMsg, AIMsg]
    currentMemory: ChatMemory
) {
    let history = [...(currentMemory.conversation_history || []), ...newMessages];
    let summary = currentMemory.conversation_summary;

    // Summarize if history gets too long (e.g., > 20 messages)
    if (history.length > 20) {
        const oldestMessages = history.slice(0, 10); // Take oldest 10
        const recentMessages = history.slice(10);    // Keep recent 10+

        // Generate summary of oldest messages
        const newSummary = await summarizeConversation(oldestMessages, summary);

        history = recentMessages;
        summary = newSummary;
    }

    // Update DB
    await supabase
        .from('chat_memory')
        .update({
            conversation_history: history,
            conversation_summary: summary,
            last_interaction: new Date().toISOString()
        })
        .eq('id', memoryId);
}

async function summarizeConversation(messages: any[], previousSummary: string | null): Promise<string> {
    const contentToSummarize = messages.map(m => `${m.role}: ${m.content} `).join('\n');

    const prompt = `
Tarefa: Resumir a conversa abaixo para manter o contexto.
Resumo anterior: ${previousSummary || 'Nenhum'}

Novas mensagens para incorporar:
${contentToSummarize}

Instruções:
- Crie um único parágrafo conciso(max 3 linhas).
- Mantenha fatos importantes: nome do cliente, preferências, produtos discutidos, datas mencionadas.
- Ignore saudações e conversa fiada.
- Retorne APENAS o texto do resumo.
`;

    try {
        const response = await callAI({
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 200,
            temperature: 0.3
        });
        return response.content;
    } catch (e) {
        console.error('Error generating summary:', e);
        return previousSummary || ''; // Fallback
    }
}
