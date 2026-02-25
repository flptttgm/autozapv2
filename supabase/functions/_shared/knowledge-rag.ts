// ============================================
// Knowledge RAG - Semantic Search & Context Retrieval
// ============================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { generateEmbedding } from './ai-client.ts';

export async function searchKnowledgeBase(
    supabase: SupabaseClient,
    workspaceId: string,
    query: string,
    agentId?: string | null
): Promise<string> {
    try {
        // 1. Generate embedding for user query
        const embedding = await generateEmbedding(query);

        // 2. Search via RPC (vector similarity)
        const { data: results, error } = await supabase.rpc('match_knowledge_base', {
            query_embedding: `[${embedding.join(',')}]`,
            p_workspace_id: workspaceId,
            p_agent_id: agentId,
            match_threshold: 0.5,
            match_count: 5
        });

        if (error) {
            console.error('RAG search error:', error);
            return '';
        }

        if (!results || results.length === 0) {
            return '';
        }

        // 3. Format results for system prompt
        let context = '';
        const categoryMap: Record<string, string[]> = {};

        results.forEach((item: any) => {
            if (!categoryMap[item.category]) categoryMap[item.category] = [];
            categoryMap[item.category].push(`${item.title}: ${item.content} `);
        });

        for (const [category, items] of Object.entries(categoryMap)) {
            context += `\n### ${category.toUpperCase()} \n${items.join('\n')} \n`;
        }

        return context;
    } catch (e) {
        console.error('RAG process failed:', e);
        return ''; // Fail gracefully (empty context)
    }
}
