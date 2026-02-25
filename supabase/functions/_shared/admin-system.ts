
import { SupabaseClient } from "@supabase/supabase-js";
import { callAI } from './ai-client.ts';


export interface AdminCommandResult {
    isCommand: boolean;
    response?: string;
    actionTaken?: string;
}

/**
 * Checks if the sender is an admin of the specified workspace or a global admin.
 */
export async function isAdmin(supabase: SupabaseClient, phone: string, workspaceId: string): Promise<boolean> {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, whatsapp_number')
        .eq('whatsapp_number', phone)
        .maybeSingle();

    if (error || !profile) return false;

    const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('user_id', profile.id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

    if (memberError || !membership) return false;

    return ['owner', 'admin'].includes(membership.role);
}

/**
 * Handles administrative commands sent via WhatsApp.
 */
export async function handleAdminCommand(
    supabase: SupabaseClient,
    phone: string,
    workspaceId: string,
    content: string
): Promise<AdminCommandResult> {
    // 1. Identify intent using AI (or simple regex for common ones)
    const classificationPrompt = `
Classifique a seguinte mensagem de um administrador como uma ação específica ou "none":
Mensage: "${content}"

Ações possíveis:
- pause_ai: Ex: "pausar ia do pedro", "para o bot do joão"
- resume_ai: Ex: "ligar ia da maria", "solta o bot do carlos"
- daily_report: Ex: "resumo do dia", "quantos leads hoje"
- send_proxy: Ex: "responder maria: olá, tudo bem?"

Retorne APENAS um JSON no formato: {"action": "action_name", "target": "target_name/content"}
`;

    try {
        const aiResponse = await callAI({
            messages: [{ role: 'system', content: classificationPrompt }],
            maxTokens: 100,
            temperature: 0
        });

        const parsed = JSON.parse(aiResponse.content);
        const action = parsed.action;
        const target = parsed.target;

        if (action === 'none') return { isCommand: false };

        // 2. Execute Action
        let response = "Comando não reconhecido.";
        let actionTaken = action;

        if (action === 'pause_ai') {
            const { data: lead } = await supabase.from('leads')
                .select('id, name')
                .ilike('name', `%${target}%`)
                .eq('workspace_id', workspaceId)
                .limit(1).maybeSingle();

            if (lead) {
                await supabase.from('chat_memory')
                    .update({ ai_paused: true })
                    .eq('lead_id', lead.id);
                response = `✅ IA pausada para o lead: *${lead.name}*.`;
            } else {
                response = `❌ Lead "${target}" não encontrado.`;
            }
        }

        if (action === 'resume_ai') {
            const { data: lead } = await supabase.from('leads')
                .select('id, name')
                .ilike('name', `%${target}%`)
                .eq('workspace_id', workspaceId)
                .limit(1).maybeSingle();

            if (lead) {
                await supabase.from('chat_memory')
                    .update({ ai_paused: false })
                    .eq('lead_id', lead.id);
                response = `✅ IA ativada novamente para o lead: *${lead.name}*.`;
            } else {
                response = `❌ Lead "${target}" não encontrado.`;
            }
        }

        return { isCommand: true, response, actionTaken };
    } catch (e) {
        console.error('[AdminSystem] Error processing command:', e);
        return { isCommand: false };
    }
}
