
import { SupabaseClient } from "@supabase/supabase-js";
import { callAI } from './ai-client.ts';


export interface AdminCommandResult {
    isCommand: boolean;
    response?: string;
    actionTaken?: string;
}

/**
 * Checks if the sender is an admin of the specified workspace.
 * Priority 1: Check workspace_admin_phones table (explicit admin phone registration)
 * Priority 2: Check profiles.whatsapp_number + workspace_members role
 */
export async function isAdmin(supabase: SupabaseClient, phone: string, workspaceId: string): Promise<boolean> {
    // Normalize phone for comparison (remove non-digits)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Priority 1: Check workspace_admin_phones (explicit registration via Settings)
    const { data: adminPhone } = await supabase
        .from('workspace_admin_phones')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('phone', normalizedPhone)
        .eq('is_active', true)
        .maybeSingle();

    if (adminPhone) {
        console.log('[AdminSystem] ✅ Admin identified via workspace_admin_phones:', normalizedPhone);
        return true;
    }

    // Also try with 55 prefix if not present, or without if present
    const altPhone = normalizedPhone.startsWith('55')
        ? normalizedPhone.substring(2)
        : '55' + normalizedPhone;

    const { data: adminPhoneAlt } = await supabase
        .from('workspace_admin_phones')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('phone', altPhone)
        .eq('is_active', true)
        .maybeSingle();

    if (adminPhoneAlt) {
        console.log('[AdminSystem] ✅ Admin identified via workspace_admin_phones (alt phone):', altPhone);
        return true;
    }

    // Priority 2: Fallback to profiles.whatsapp_number check
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
    // 1. Identify intent using AI
    const classificationPrompt = `
Classifique a seguinte mensagem de um administrador como uma ação específica ou "none":
Mensagem: "${content}"

Ações possíveis:
- pause_ai: Ex: "pausar ia do pedro", "para o bot do joão"
- resume_ai: Ex: "ligar ia da maria", "solta o bot do carlos"
- daily_report: Ex: "resumo do dia", "quantos leads hoje", "como tá o dia", "métricas", "últimos leads"
- none: Se não for nenhuma das ações acima

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

        if (action === 'daily_report') {
            // Use Brazil timezone (UTC-3) for accurate day boundary
            const nowBrazil = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
            nowBrazil.setHours(0, 0, 0, 0);
            // Convert back to UTC for database comparison
            const todayISO = new Date(nowBrazil.getTime() + 3 * 60 * 60 * 1000).toISOString();

            // Count leads created today
            const { count: newLeadsCount } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('workspace_id', workspaceId)
                .gte('created_at', todayISO);

            // Count total leads
            const { count: totalLeadsCount } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('workspace_id', workspaceId);

            // Count messages today
            const { count: msgsToday } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('workspace_id', workspaceId)
                .gte('created_at', todayISO);

            // Count inbound messages today
            const { count: inboundToday } = await supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('workspace_id', workspaceId)
                .eq('direction', 'inbound')
                .gte('created_at', todayISO);

            // Last 5 leads
            const { data: recentLeads } = await supabase
                .from('leads')
                .select('name, phone, created_at')
                .eq('workspace_id', workspaceId)
                .order('created_at', { ascending: false })
                .limit(5);

            const leadsList = recentLeads?.map((l, i) =>
                `${i + 1}. *${l.name}* (${l.phone})`
            ).join('\n') || 'Nenhum lead encontrado.';

            response = `📊 *Resumo do Dia*\n\n` +
                `📈 *Leads hoje:* ${newLeadsCount || 0}\n` +
                `👥 *Total de leads:* ${totalLeadsCount || 0}\n` +
                `💬 *Mensagens hoje:* ${msgsToday || 0}\n` +
                `📩 *Recebidas hoje:* ${inboundToday || 0}\n` +
                `📤 *Enviadas hoje:* ${(msgsToday || 0) - (inboundToday || 0)}\n\n` +
                `🕐 *Últimos 5 leads:*\n${leadsList}`;
        }

        return { isCommand: true, response, actionTaken };
    } catch (e) {
        console.error('[AdminSystem] Error processing command:', e);
        return { isCommand: false };
    }
}
