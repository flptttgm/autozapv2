import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Bot, Plus, Rocket, Trash2, Pencil, Zap, Brain,
    Wrench, Calendar, Search, UserCheck, Loader2,
    Star, Heart, User, Coffee, MessageCircle, Sparkles,
    Shield, Target, Award, Crown, Lightbulb,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SuperAgentWizard } from "./SuperAgentWizard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const iconMap: Record<string, React.ElementType> = {
    bot: Bot, user: User, heart: Heart, star: Star, zap: Zap,
    coffee: Coffee, "message-circle": MessageCircle, sparkles: Sparkles,
    shield: Shield, target: Target, award: Award, crown: Crown,
    lightbulb: Lightbulb, rocket: Rocket, brain: Brain, wrench: Wrench,
};

const toolLabels: Record<string, string> = {
    check_appointments: "Agendamentos",
    check_availability: "Disponibilidade",
    schedule_appointment: "Agendar",
    get_lead_info: "Info Cliente",
};

interface SuperAgentsListProps {
    workspaceId: string;
}

export const SuperAgentsList = ({ workspaceId }: SuperAgentsListProps) => {
    const queryClient = useQueryClient();
    const [view, setView] = useState<"list" | "create" | "edit">("list");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editAgent, setEditAgent] = useState<any>(null);

    const { data: agents = [], isLoading } = useQuery({
        queryKey: ["super-agents", workspaceId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("super_agents")
                .select("*")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!workspaceId,
    });

    // Fetch instances to show which ones use each agent
    const { data: instances = [] } = useQuery({
        queryKey: ["whatsapp-instances-super", workspaceId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("whatsapp_instances")
                .select("id, display_name, phone, super_agent_id, agent_engine")
                .eq("workspace_id", workspaceId);
            if (error) throw error;
            return data;
        },
        enabled: !!workspaceId,
    });

    const deleteMutation = useMutation({
        mutationFn: async (agentId: string) => {
            await supabase
                .from("whatsapp_instances")
                .update({ agent_engine: null, super_agent_id: null })
                .eq("super_agent_id", agentId);
            const { error } = await supabase
                .from("super_agents")
                .delete()
                .eq("id", agentId);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Agente removido");
            queryClient.invalidateQueries({ queryKey: ["super-agents"] });
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            setDeleteId(null);
        },
        onError: (err: any) => {
            toast.error(`Erro: ${err.message}`);
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // ─── WIZARD VIEW (create or edit) ───
    if (view === "create" || view === "edit") {
        return (
            <SuperAgentWizard
                workspaceId={workspaceId}
                editAgent={view === "edit" ? editAgent : undefined}
                onCancel={() => {
                    setView("list");
                    setEditAgent(null);
                }}
                onComplete={() => {
                    setView("list");
                    setEditAgent(null);
                }}
            />
        );
    }

    // ─── LIST VIEW ───
    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        Agentes
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Agentes proativos com ferramentas, RAG e memória avançada
                    </p>
                </div>
                <Button onClick={() => setView("create")} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Criar Agente
                </Button>
            </div>

            {/* Agent Cards */}
            {agents.length === 0 ? (
                <Card className="p-10 text-center border-dashed">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center mx-auto mb-4">
                            <Rocket className="h-8 w-8 text-primary/50" />
                        </div>
                        <h4 className="font-semibold text-lg mb-1">Nenhum agente criado</h4>
                        <p className="text-sm text-muted-foreground mb-5">
                            Crie seu primeiro agente de IA com prompt personalizado, ferramentas e personalidade única.
                            Ele vai atender seus clientes 24/7!
                        </p>
                        <Button className="gap-2" onClick={() => setView("create")}>
                            <Plus className="h-4 w-4" />
                            Criar meu primeiro Agente
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {agents.map((agent: any) => {
                        const IconComp = iconMap[agent.icon] || Bot;
                        const linkedInstances = instances.filter((i: any) => i.super_agent_id === agent.id);
                        const tools = agent.enabled_tools || [];

                        return (
                            <Card key={agent.id} className="p-4 hover:border-primary/30 transition-all group">
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                                        <IconComp className="h-6 w-6" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold truncate">{agent.name}</h4>
                                            {agent.persona_name && (
                                                <span className="text-sm text-muted-foreground">({agent.persona_name})</span>
                                            )}
                                            <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px] px-1.5">
                                                SUPER
                                            </Badge>
                                        </div>

                                        {/* Prompt preview */}
                                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                            {agent.system_prompt?.slice(0, 150)}
                                            {agent.system_prompt?.length > 150 && "..."}
                                        </p>

                                        {/* Tools + instances */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {tools.map((t: string) => (
                                                <Badge key={t} variant="outline" className="text-[10px] gap-1">
                                                    <Wrench className="h-2.5 w-2.5" />
                                                    {toolLabels[t] || t}
                                                </Badge>
                                            ))}
                                            {linkedInstances.length > 0 && (
                                                <Badge variant="secondary" className="text-[10px] gap-1 ml-1">
                                                    <Zap className="h-2.5 w-2.5" />
                                                    {linkedInstances.length} instância{linkedInstances.length > 1 ? 's' : ''}
                                                </Badge>
                                            )}
                                            {linkedInstances.length === 0 && (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                                    Não aplicado
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                            onClick={() => {
                                                setEditAgent(agent);
                                                setView("edit");
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteId(agent.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Agente?</AlertDialogTitle>
                        <AlertDialogDescription>
                            As instâncias vinculadas ficarão sem agente. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                        >
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
