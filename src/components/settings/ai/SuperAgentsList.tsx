import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
    Bot, Plus, Rocket, Trash2, Pencil, Zap, Brain,
    Wrench, Calendar, Search, UserCheck, Loader2,
    Star, Heart, User, Coffee, MessageCircle, Sparkles,
    Shield, Target, Award, Crown, Lightbulb, AlertTriangle,
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
import { AIPreviewChat } from "../../whatsapp/AIPreviewChat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

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
    onEditStateChange?: (isEditing: boolean) => void;
}

export const SuperAgentsList = ({ workspaceId, onEditStateChange }: SuperAgentsListProps) => {
    const queryClient = useQueryClient();
    const [view, setView] = useState<"list" | "create" | "edit">("list");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [editAgent, setEditAgent] = useState<any>(null);
    const [previewAgentId, setPreviewAgentId] = useState<string | null>(null);
    const { t } = useTranslation("agents");

    // Notify parent when entering/leaving wizard view
    useEffect(() => {
        onEditStateChange?.(view === "create" || view === "edit");
    }, [view, onEditStateChange]);

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
            toast.success(t("agentRemoved"));
            queryClient.invalidateQueries({ queryKey: ["super-agents"] });
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            setDeleteId(null);
            setDeleteConfirmText("");
        },
        onError: (err: any) => {
            toast.error(`${t("error")}: ${err.message}`);
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        {t("superAgents")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {t("superAgentsDesc")}
                    </p>
                </div>
                <Button onClick={() => setView("create")} className="gap-2 w-full sm:w-auto">
                    <Plus className="h-4 w-4" />
                    {t("createAgent")}
                </Button>
            </div>

            {/* Agent Cards */}
            {agents.length === 0 ? (
                <Card className="p-10 text-center border-dashed">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-violet-500/10 flex items-center justify-center mx-auto mb-4">
                            <Rocket className="h-8 w-8 text-primary/50" />
                        </div>
                        <h4 className="font-semibold text-lg mb-1">{t("noAgentsTitle")}</h4>
                        <p className="text-sm text-muted-foreground mb-5">
                            {t("noAgentsDesc")}
                        </p>
                        <Button className="gap-2" onClick={() => setView("create")}>
                            <Plus className="h-4 w-4" />
                            {t("createFirstAgent")}
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
                            <Card key={agent.id} className="p-4 hover:border-primary/30 transition-all group overflow-hidden">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    {/* Icon */}
                                    <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                                        <IconComp className="h-5 w-5 sm:h-6 sm:w-6" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h4 className="font-semibold truncate max-w-[150px] sm:max-w-none">{agent.name}</h4>
                                            {agent.persona_name && (
                                                <span className="text-sm text-muted-foreground hidden sm:inline">({agent.persona_name})</span>
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
                                                    {linkedInstances.length} {linkedInstances.length > 1 ? t("instancesPlural") : t("instances")}
                                                </Badge>
                                            )}
                                            {linkedInstances.length === 0 && (
                                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                                                    {t("notApplied")}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions - hidden on mobile, shown on hover on desktop */}
                                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1.5 text-xs font-medium border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/50 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewAgentId(agent.id);
                                            }}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                            {t("testBtn")}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
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
                                            className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => setDeleteId(agent.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Mobile actions row */}
                                <div className="flex sm:hidden items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 text-xs font-medium flex-1 border-purple-500/30 text-purple-600 dark:text-purple-400"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewAgentId(agent.id);
                                        }}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {t("testBtn")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground"
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
                                        className="h-8 w-8 text-destructive"
                                        onClick={() => setDeleteId(agent.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Delete confirmation — type agent name to confirm */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) { setDeleteId(null); setDeleteConfirmText(""); } }}>
                <AlertDialogContent className="max-w-md">
                    {(() => {
                        const agentToDelete = agents.find((a: any) => a.id === deleteId);
                        const AgentDeleteIcon = agentToDelete ? (iconMap[agentToDelete.icon] || Bot) : Bot;
                        const agentName = agentToDelete?.name || "";
                        const isConfirmed = deleteConfirmText.trim().toLowerCase() === agentName.trim().toLowerCase();

                        return (
                            <>
                                <AlertDialogHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2.5 rounded-xl bg-destructive/10">
                                            <AgentDeleteIcon className="h-5 w-5 text-destructive" />
                                        </div>
                                        <div>
                                            <AlertDialogTitle className="text-left">{t("removeAgent")}</AlertDialogTitle>
                                            <p className="text-xs text-muted-foreground text-left">{agentName}</p>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                        <AlertDialogDescription className="text-xs text-left leading-relaxed">
                                            {t("removeWarning")}
                                        </AlertDialogDescription>
                                    </div>
                                </AlertDialogHeader>

                                <div className="space-y-2 pt-1">
                                    <p className="text-sm text-foreground">
                                        {t("typeToConfirm").split("<1>")[0]}
                                        <strong className="text-destructive">{agentName}</strong>
                                        {t("typeToConfirm").split("</1>")[1]}
                                    </p>
                                    <Input
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder={agentName}
                                        className={cn(
                                            "h-10 transition-colors",
                                            isConfirmed && "border-destructive focus-visible:ring-destructive/30"
                                        )}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && isConfirmed && deleteId) {
                                                deleteMutation.mutate(deleteId);
                                            }
                                        }}
                                    />
                                </div>

                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>{t("cancel")}</AlertDialogCancel>
                                    <Button
                                        variant="destructive"
                                        disabled={!isConfirmed || deleteMutation.isPending}
                                        onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                        className="gap-1.5"
                                    >
                                        {deleteMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                        {t("removePermanently")}
                                    </Button>
                                </AlertDialogFooter>
                            </>
                        );
                    })()}
                </AlertDialogContent>
            </AlertDialog>

            {/* Preview IA Sheet */}
            <Sheet open={!!previewAgentId} onOpenChange={(open) => !open && setPreviewAgentId(null)}>
                <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
                    {(() => {
                        const previewAgent = agents.find((a: any) => a.id === previewAgentId);
                        const AgentIcon = previewAgent ? (iconMap[previewAgent.icon] || Bot) : Bot;
                        return (
                            <div className="shrink-0 bg-gradient-to-r from-purple-600 to-violet-600 px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                                            <AgentIcon className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-purple-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-white truncate">
                                                {previewAgent?.name || 'Agente'}
                                            </h3>
                                            <Badge className="bg-white/15 text-white text-[10px] px-1.5 py-0 border-0 backdrop-blur-sm">
                                                {t("preview")}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-white/70 truncate mt-0.5">
                                            {previewAgent?.persona_name || 'Assistente de IA'} · {t("online")}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                    <div className="flex-1 overflow-hidden p-4">
                        {previewAgentId && (
                            <AIPreviewChat
                                workspaceId={workspaceId}
                                templateId={previewAgentId}
                                templateName={agents.find((a: any) => a.id === previewAgentId)?.persona_name || agents.find((a: any) => a.id === previewAgentId)?.name || 'Agente'}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
};
