import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Zap, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SuperAgentsPromoCardProps {
    className?: string;
    workspaceId?: string;
}

export const SuperAgentsPromoCard = ({ className, workspaceId }: SuperAgentsPromoCardProps) => {
    const navigate = useNavigate();

    const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
        queryKey: ["super-agents", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];
            const { data, error } = await supabase
                .from("super_agents")
                .select("id, name, persona_name")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data || [];
        },
        enabled: !!workspaceId,
    });

    const { data: ragCount = 0 } = useQuery({
        queryKey: ["knowledge-base-count", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return 0;
            const { count, error } = await supabase
                .from("knowledge_base")
                .select("*", { count: 'exact', head: true })
                .eq("workspace_id", workspaceId)
                .eq("is_active", true);

            if (error) throw error;
            return count || 0;
        },
        enabled: !!workspaceId,
    });

    const agentsCount = agents.length;
    const isLoading = isLoadingAgents;

    return (
        <Card
            className={cn(
                "border-border shadow-sm overflow-hidden relative group cursor-pointer hover:border-primary/50 transition-all duration-500",
                className
            )}
            onClick={() => navigate('/ai-settings')}
        >
            {/* Dynamic Backgrounds */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background z-0" />
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px] -z-10 group-hover:bg-primary/30 transition-colors duration-700" />
            <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-purple-500/10 rounded-full blur-[60px] -z-10 group-hover:bg-purple-500/20 transition-colors duration-700" />

            {/* Border glow effect on hover */}
            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <CardContent className="p-6 relative z-10 h-full flex flex-col justify-between min-h-[220px]">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary w-fit">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Novo Recurso</span>
                        </div>
                        {agentsCount > 0 && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{agentsCount} Ativo{agentsCount > 1 ? 's' : ''}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                            Super Agentes IA
                            <Bot className="h-6 w-6 text-primary animate-pulse" />
                        </h3>
                        {isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Carregando status...
                            </div>
                        ) : agentsCount > 0 ? (
                            <div className="space-y-3">
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    <strong className="text-foreground">
                                        {agents.map(a => `${a.name} ${a.persona_name ? `(${a.persona_name})` : ''}`.trim()).join(", ")}
                                    </strong>
                                    {" "}{agentsCount > 1 ? 'estão operando' : 'está operando'} no momento.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border text-xs text-muted-foreground">
                                        <Bot className="h-3.5 w-3.5" />
                                        {agentsCount} Agente{agentsCount > 1 ? 's' : ''}
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border text-xs text-muted-foreground">
                                        <Zap className="h-3.5 w-3.5" />
                                        {ragCount} Arquivo{ragCount > 1 ? 's' : ''} no RAG
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm max-w-[85%] leading-relaxed">
                                Você ainda não tem agentes configurados. Crie agentes especialistas para agendar reuniões, qualificar leads e fechar vendas 24/7.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-purple-500/20" />
                                <Zap className="h-3 w-3 text-primary relative z-10" />
                            </div>
                        ))}
                    </div>

                    <Button
                        className="rounded-full gap-2 group-hover:scale-105 transition-transform shadow-lg shadow-primary/25"
                    >
                        {agentsCount > 0 ? "Gerenciar Agentes" : "Configurar agora"}
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
