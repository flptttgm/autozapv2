// ============================================
// Prompt Builder - Hierarchical System Prompt Construction
// ============================================

interface PromptContext {
    identity: {
        name: string;
        role: string;
        companyName: string;
    };
    behavior: {
        tone: number;
        verbosity: number;
        proactivity: number;
        useEmojis: boolean;
        nicheScope?: string; // Phase 3: Level 2
    };
    dateContext: {
        now: Date;
        timezoneOffset: number;
    };
    knowledgeBase?: string; // Formatted KB content
    leadContext?: {
        name?: string;
        isReturning: boolean;
        scriptCompleted?: boolean; // Phase 3: Level 3
    };
    forceButtons?: boolean; // Phase 3: Level 6
}

export function buildSystemPrompt(context: PromptContext): string {
    const { identity, behavior, dateContext, knowledgeBase, leadContext, forceButtons } = context;

    let segments: string[] = [];

    // LEVEL 1: REGRAS DE OURO (Identidade e Segurança)
    segments.push(`[🔴 REGRAS DE OURO]
Você é ${identity.name}, ${identity.role} da ${identity.companyName}.
NUNCA invente preços ou dados que não estão na base.
Use sempre frase de escape se não souber a resposta.`);

    // LEVEL 2: REGRA DE ESCOPO
    if (behavior.nicheScope) {
        segments.push(`[🟣 REGRA DE ESCOPO]
Seu escopo de atuação é estritamente: ${behavior.nicheScope}.
Se perguntarem algo fora disso, recuse educadamente.`);
    }

    // LEVEL 3: SCRIPT COMPLETION OVERRIDE
    if (leadContext?.scriptCompleted) {
        segments.push(`[🔵 SCRIPT COMPLETED]
O lead já passou pelo funil inicial. Você tem LIBERDADE TOTAL para falar sobre preços e detalhes técnicos avançados.`);
    }

    // LEVEL 4: KNOWLEDGE BASE (RAG)
    if (knowledgeBase) {
        segments.push(`[🟡 BASE DE CONHECIMENTO]
Sua única fonte de verdade:
${knowledgeBase}`);
    }

    // LEVEL 5: ESTILO E COMPORTAMENTO
    segments.push(`[🟢 ESTILO]
Tom: ${getToneDescription(behavior.tone)}
Emojis: ${behavior.useEmojis ? 'Sim' : 'Não'}`);

    // LEVEL 6: BUTTONS OVERRIDE
    if (forceButtons && !leadContext?.scriptCompleted) {
        segments.push(`[⚪ BUTTONS ENFORCEMENT]
Sempre ofereça opções em formato [BOTOES: Opção 1, Opção 2].`);
    }

    return segments.join('\n\n');
}

function getNextWeekday(date: Date, dayIndex: number): Date {
    const ret = new Date(date);
    ret.setDate(ret.getDate() + (dayIndex - 1 - ret.getDay() + 7) % 7 + 1);
    return ret;
}

function getToneDescription(level: number): string {
    if (level < 30) return 'Formal e sério.';
    if (level > 70) return 'Animado, amigável e casual.';
    return 'Profissional, mas simpático (equilibrado).';
}

function getVerbosityDescription(level: number): string {
    if (level < 30) return 'Muito conciso. Respostas diretas de 1-2 frases.';
    if (level > 70) return 'Detalhado e explicativo.';
    return 'Objetivo, mas completo (3-4 frases).';
}
