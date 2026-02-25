
// ============================================
// AI Client - Direct API call (flexible: OpenAI, Gemini, etc.)
// ============================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export { corsHeaders };

import { createClient } from "@supabase/supabase-js";

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface AICallOptions {
    messages: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
    model?: string;
    tools?: any[];
    toolChoice?: any;
}

interface AIResponse {
    content: string;
    toolCalls?: any[];
    usage?: { promptTokens: number; completionTokens: number };
}

/**
 * Call the AI model using OpenAI-compatible API format.
 * Supports: OpenAI (GPT-4o-mini), Lovable Gateway (Gemini), or direct Gemini.
 * The provider is determined by the environment variables set in Supabase secrets.
 */
export async function callAI(options: AICallOptions): Promise<AIResponse> {
    const { messages, maxTokens = 800, temperature = 0.3, model: modelOverride, tools, toolChoice } = options;

    // Priority: AI_API_KEY
    const apiKey = Deno.env.get('AI_API_KEY');
    const apiUrl = Deno.env.get('AI_API_URL') || 'https://api.openai.com/v1/chat/completions';
    const model = modelOverride || Deno.env.get('AI_MODEL') || 'gpt-4o-mini';

    if (!apiKey) {
        throw new Error('No AI API key configured. Set AI_API_KEY in Supabase secrets.');
    }

    const isGeminiDirect = apiUrl.includes('generativelanguage.googleapis.com');

    if (isGeminiDirect) {
        return callGeminiDirect(apiKey, model, messages, maxTokens, temperature, tools, toolChoice);
    }

    // OpenAI-compatible format (works with OpenAI, Lovable Gateway, Azure, etc.)
    return callOpenAICompatible(apiKey, apiUrl, model, messages, maxTokens, temperature, tools, toolChoice);
}

async function callOpenAICompatible(
    apiKey: string,
    apiUrl: string,
    model: string,
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number,
    tools?: any[],
    toolChoice?: any
): Promise<AIResponse> {
    const body: any = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
    };

    if (tools) body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[ai-client] API call attempt ${attempt}/${maxRetries} to ${apiUrl.substring(0, 50)}`);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                const data = await response.json();
                const choice = data.choices[0];

                return {
                    content: choice.message.content || '',
                    toolCalls: choice.message.tool_calls,
                    usage: data.usage ? {
                        promptTokens: data.usage.prompt_tokens,
                        completionTokens: data.usage.completion_tokens,
                    } : undefined,
                };
            }

            const errorText = await response.text();
            console.error(`[ai-client] Error on attempt ${attempt}:`, response.status, errorText);

            // Only retry on 5xx server errors
            if (response.status >= 500 && attempt < maxRetries) {
                const backoffMs = 1000 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }

            lastError = new Error(`AI API error: ${response.status} - ${errorText}`);
            break;
        } catch (fetchError) {
            lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
            if (attempt < maxRetries) {
                const backoffMs = 1000 * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
    }

    throw lastError || new Error('AI call failed after retries');
}

async function callGeminiDirect(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number,
    _tools?: any[],
    _toolChoice?: any
): Promise<AIResponse> {
    // Extract system instruction
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const systemInstruction = systemMessages.map(m => m.content).join('\n\n');

    const contents = nonSystemMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    // Clean model name (remove provider prefix if any)
    const modelName = model.includes('/') ? model.split('/').pop()! : model;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                contents,
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
        content,
        usage: data.usageMetadata ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        } : undefined,
    };
}

/**
 * Generate text embedding using Gemini text-embedding-004 model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = Deno.env.get('AI_API_KEY');
    if (!apiKey) throw new Error('No AI API key configured');

    const model = 'text-embedding-3-small';

    const response = await fetch(
        'https://api.openai.com/v1/embeddings',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                input: text
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Embedding error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

/**
 * Convert Markdown formatting to WhatsApp formatting
 */
export function convertMarkdownToWhatsApp(text: string): string {
    if (!text) return text;

    let result = text;

    // **bold** → *bold* (WhatsApp uses single asterisk)
    result = result.replace(/\*\*(.+?)\*\*/g, '*$1*');

    // __italic__ → _italic_ (already correct for WhatsApp)
    result = result.replace(/__(.+?)__/g, '_$1_');

    // ### Header → *Header* (make headers bold in WhatsApp)
    result = result.replace(/^#{1,3}\s+(.+)$/gm, '*$1*');

    // Remove ```code blocks``` markers but keep content
    result = result.replace(/```[\w]*\n?/g, '');

    return result.trim();
}
