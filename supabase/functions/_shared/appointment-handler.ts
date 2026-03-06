// ============================================
// Appointment Handler - Scheduling Logic
// ============================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { callAI } from './ai-client.ts';

interface AppointmentContext {
    pending?: boolean;
    intent?: 'new' | 'reschedule' | 'cancel';
    originalAppointmentId?: string;
    extracted?: {
        date?: string;
        time?: string;
        purpose?: string;
    };
}

export async function handleAppointmentFlow(
    supabase: SupabaseClient,
    workspaceId: string,
    leadId: string,
    message: string,
    contextFlags: any,
    timezoneOffset: number = -3
): Promise<{
    response?: string;
    updatedFlags?: any;
    action?: string;
    data?: any
}> {
    const currentContext = contextFlags?.appointment || {};

    // 1. Check for basic intent if not already in flow
    if (!currentContext.pending) {
        const intent = await detectAppointmentIntent(message);
        if (!intent) return { updatedFlags: contextFlags };

        // Initialize flow
        return {
            updatedFlags: {
                ...contextFlags,
                appointment: { pending: true, intent }
            },
            // Let the main AI prompt handle the first response, or return a specific one here
            // For now, we'll just flag it so the main system prompt knows we are in appointment mode
        };
    }

    // 2. We are in a pending flow - try to extract details
    const extraction = await extractAppointmentDetails(message, timezoneOffset);

    if (!extraction.date && !extraction.time) {
        // User didn't provide time yet
        return { response: undefined }; // Let main AI ask for time
    }

    // Merge with existing extracted data
    const mergedData = { ...currentContext.extracted, ...extraction };

    // 3. If we have date and time, check availability
    if (mergedData.date && mergedData.time) {
        const startDateTime = new Date(`${mergedData.date}T${mergedData.time}:00`);
        // Adjust for timezone if needed (input is local, DB expects UTC)
        // Simple approach: Assume input is local time of the workspace
        const startUTC = new Date(startDateTime.getTime() - (timezoneOffset * 3600000));
        const endUTC = new Date(startUTC.getTime() + (60 * 60000)); // Default 1 hour

        if (currentContext.intent === 'new' || currentContext.intent === 'reschedule') {
            const isAvailable = await checkAvailability(supabase, workspaceId, startUTC, endUTC);

            if (!isAvailable) {
                return {
                    response: `Verifiquei aqui e o horário de ${mergedData.date} às ${mergedData.time} já está ocupado. Poderia ser em outro horário?`,
                    updatedFlags: {
                        ...contextFlags,
                        appointment: { ...currentContext, extracted: { ...mergedData, time: undefined } } // Clear time to ask again
                    }
                };
            }

            // CONFIRMATION STEP could be added here. For now, let's schedule.
            if (currentContext.intent === 'new') {
                const { data: appt, error } = await supabase
                    .from('appointments')
                    .insert({
                        workspace_id: workspaceId,
                        lead_id: leadId,
                        title: mergedData.purpose || 'Agendamento via WhatsApp',
                        start_time: startUTC.toISOString(),
                        end_time: endUTC.toISOString(),
                        status: 'scheduled'
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Create an audit log entry explicitly for the global timeline
                await supabase.from('audit_logs').insert({
                    workspace_id: workspaceId,
                    user_id: '00000000-0000-0000-0000-000000000000', // system/ai fallback
                    user_name: 'Inteligência Artificial',
                    action: 'create',
                    entity_type: 'appointment',
                    entity_id: appt?.id,
                    changes_summary: `Agendamento criado via IA: ${mergedData.purpose || 'Reunião'} para ${mergedData.date} às ${mergedData.time}`
                });

                return {
                    response: `✅ Agendado com sucesso para ${mergedData.date} às ${mergedData.time}!`,
                    updatedFlags: { ...contextFlags, appointment: null }, // Clear flow
                    action: 'scheduled',
                    data: appt
                };
            }
        }
    }

    return {
        updatedFlags: {
            ...contextFlags,
            appointment: { ...currentContext, extracted: mergedData }
        }
    };
}

// Helpers

async function detectAppointmentIntent(text: string): Promise<'new' | 'reschedule' | 'cancel' | null> {
    const t = text.toLowerCase();
    if (t.includes('cancelar') && t.includes('agendamento')) return 'cancel';
    if (t.includes('remarcar') || t.includes('reagendar') || (t.includes('mudar') && t.includes('horário'))) return 'reschedule';
    if (t.includes('agendar') || t.includes('marcar') || t.includes('reunião')) return 'new';
    return null;
}

async function extractAppointmentDetails(text: string, tzOffset: number) {
    const prompt = `
Extraia data e hora desta mensagem: "${text}"
Hoje é: ${new Date().toISOString()} (UTC)
Timezone offset: ${tzOffset}

Retorne JSON puro:
{
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "purpose": string | null
}
Use lógica de calendario (amanhã, segunda, etc).
`;

    try {
        const res = await callAI({
            messages: [{ role: 'user', content: prompt }],
            maxTokens: 100,
            temperature: 0
        });
        return JSON.parse(res.content.replace(/```json|```/g, ''));
    } catch (e) {
        console.error('Extraction failed', e);
        return {};
    }
}

async function checkAvailability(
    supabase: SupabaseClient,
    workspaceId: string,
    start: Date,
    end: Date
): Promise<boolean> {
    const { data } = await supabase
        .from('appointments')
        .select('id')
        .eq('workspace_id', workspaceId)
        .neq('status', 'cancelled')
        .or(`and(start_time.lte.${end.toISOString()},end_time.gte.${start.toISOString()})`)
        .limit(1);

    return !data || data.length === 0;
}
