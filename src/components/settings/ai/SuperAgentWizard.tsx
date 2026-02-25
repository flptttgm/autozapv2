import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
    User, Bot, Heart, Star, Zap, Coffee,
    MessageCircle, Sparkles, Shield, Target,
    Award, Crown, Lightbulb, Rocket, Loader2,
    Check, ChevronRight, ChevronLeft,
    Wrench, Brain, Calendar, Search, UserCheck, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AGENT_PROFILES, AgentType } from "@/lib/agent-profiles";

// ─── Icon Grid ───
const iconOptions = [
    { id: "bot", icon: Bot },
    { id: "user", icon: User },
    { id: "heart", icon: Heart },
    { id: "star", icon: Star },
    { id: "zap", icon: Zap },
    { id: "sparkles", icon: Sparkles },
    { id: "shield", icon: Shield },
    { id: "target", icon: Target },
    { id: "award", icon: Award },
    { id: "crown", icon: Crown },
    { id: "lightbulb", icon: Lightbulb },
    { id: "rocket", icon: Rocket },
    { id: "brain", icon: Brain },
    { id: "wrench", icon: Wrench },
    { id: "coffee", icon: Coffee },
    { id: "message-circle", icon: MessageCircle },
];

const getIconComponent = (id: string) => {
    return iconOptions.find((opt) => opt.id === id)?.icon || Bot;
};

// ─── Available Tools ───
const availableTools = [
    { id: "check_appointments", label: "Consultar Agendamentos", icon: Calendar, description: "Busca os agendamentos existentes do cliente" },
    { id: "check_availability", label: "Verificar Disponibilidade", icon: Search, description: "Verifica horários disponíveis para agendar" },
    { id: "schedule_appointment", label: "Agendar", icon: Calendar, description: "Cria um novo agendamento para o cliente" },
    { id: "get_lead_info", label: "Info do Cliente", icon: UserCheck, description: "Busca dados cadastrais do cliente" },
];

// ─── Types ───
interface SuperAgentWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId: string;
    onComplete?: () => void;
    editAgent?: any; // When provided, wizard opens in edit mode
}

type WizardStep = "identity" | "brain" | "apply";

const steps: { key: WizardStep; label: string; icon: React.ElementType }[] = [
    { key: "identity", label: "Identidade", icon: User },
    { key: "brain", label: "Cérebro", icon: Brain },
    { key: "apply", label: "Aplicar", icon: Zap },
];

// ─── Component ───
export const SuperAgentWizard = ({
    open,
    onOpenChange,
    workspaceId,
    onComplete,
    editAgent,
}: SuperAgentWizardProps) => {
    const isEditMode = !!editAgent;
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState<WizardStep>("identity");

    // ─── Identity State ───
    const [agentName, setAgentName] = useState("");
    const [personaName, setPersonaName] = useState("");
    const [businessGoal, setBusinessGoal] = useState("");
    const [agentType, setAgentType] = useState<AgentType | "custom">("custom");
    const [selectedIcon, setSelectedIcon] = useState("bot");
    const [highlightedType, setHighlightedType] = useState<string | null>(null);

    // ─── Brain State ───
    const [systemPrompt, setSystemPrompt] = useState("");
    const [personality, setPersonality] = useState({ tone: 50, use_emojis: true });
    const [enabledTools, setEnabledTools] = useState<string[]>([
        "check_appointments",
        "check_availability",
        "schedule_appointment",
        "get_lead_info",
    ]);
    const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState("");

    // ─── Apply State ───
    const [selectedInstances, setSelectedInstances] = useState<string[]>([]);

    // Fetch instances
    const { data: instances = [] } = useQuery({
        queryKey: ["whatsapp-instances", workspaceId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("whatsapp_instances")
                .select("id, phone, display_name, status, agent_engine, super_agent_id")
                .eq("workspace_id", workspaceId);
            if (error) throw error;
            return data;
        },
        enabled: !!workspaceId && open,
    });

    // Pre-fill state when editing
    const [initialized, setInitialized] = useState(false);
    if (open && editAgent && !initialized) {
        setAgentName(editAgent.name || "");
        setPersonaName(editAgent.persona_name || "");
        setBusinessGoal(editAgent.behavior?.business_goal || "");
        setAgentType(editAgent.agent_type || "custom");
        setSelectedIcon(editAgent.icon || "bot");
        setSystemPrompt(editAgent.system_prompt || "");
        setPersonality(editAgent.personality || { tone: 50, use_emojis: true });
        setEnabledTools(editAgent.enabled_tools || []);
        setTriggerKeywords(editAgent.trigger_keywords || []);
        // Pre-select instances that already use this agent
        const linkedIds = (instances || []).filter((i: any) => i.super_agent_id === editAgent.id).map((i: any) => i.id);
        setSelectedInstances(linkedIds);
        setInitialized(true);
    }
    if (!open && initialized) {
        setInitialized(false);
    }

    // Pre-fill from agent profile
    const handleTypeSelect = (type: AgentType | "custom") => {
        setAgentType(type);
        if (type !== "custom") {
            const profile = AGENT_PROFILES[type];
            setAgentName(profile.name);
            setSelectedIcon(profile.iconId);
            setPersonality({ tone: profile.personality.tone, use_emojis: profile.personality.use_emojis });
            setSystemPrompt(profile.system_prompt);
            setTriggerKeywords(profile.trigger_keywords);
            if (profile.suggested_personas.length > 0) {
                setPersonaName(profile.suggested_personas[Math.floor(Math.random() * profile.suggested_personas.length)]);
            }
        }
    };

    // Tool toggle
    const toggleTool = (toolId: string) => {
        setEnabledTools((prev) =>
            prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
        );
    };

    // Keyword management
    const addKeyword = () => {
        const kw = keywordInput.trim();
        if (kw && !triggerKeywords.includes(kw)) {
            setTriggerKeywords((prev) => [...prev, kw]);
            setKeywordInput("");
        }
    };

    const removeKeyword = (kw: string) => {
        setTriggerKeywords((prev) => prev.filter((k) => k !== kw));
    };

    // ─── Save Mutation (create or update) ───
    const saveMutation = useMutation({
        mutationFn: async () => {
            const agentData = {
                workspace_id: workspaceId,
                name: agentName,
                persona_name: personaName || null,
                agent_type: agentType === "custom" ? "general" : agentType,
                icon: selectedIcon,
                system_prompt: systemPrompt.replace(/{persona}/g, personaName || agentName),
                personality,
                behavior: { business_goal: businessGoal || undefined },
                enabled_tools: enabledTools,
                trigger_keywords: triggerKeywords,
                priority: 0,
                is_active: true,
            };

            let agentId: string;

            if (isEditMode) {
                // Update existing agent
                const { error: updateError } = await supabase
                    .from("super_agents")
                    .update(agentData)
                    .eq("id", editAgent.id);
                if (updateError) throw updateError;
                agentId = editAgent.id;

                // Unlink instances that were removed
                const { error: unlinkErr } = await supabase
                    .from("whatsapp_instances")
                    .update({ agent_engine: "legacy", super_agent_id: null })
                    .eq("super_agent_id", editAgent.id)
                    .not("id", "in", `(${selectedInstances.join(",")})`);
                if (unlinkErr) console.error("Unlink error:", unlinkErr);
            } else {
                // Create new agent
                const { data: superAgent, error: saError } = await supabase
                    .from("super_agents")
                    .insert(agentData)
                    .select()
                    .single();
                if (saError) throw saError;
                agentId = superAgent.id;
            }

            // Apply to selected instances
            if (selectedInstances.length > 0) {
                const { error: updateErr } = await supabase
                    .from("whatsapp_instances")
                    .update({
                        agent_engine: "super_agent",
                        super_agent_id: agentId,
                    })
                    .in("id", selectedInstances);
                if (updateErr) throw updateErr;
            }

            return { id: agentId };
        },
        onSuccess: () => {
            toast.success(isEditMode ? "Super Agent atualizado! ✅" : "Super Agent criado com sucesso! 🚀");
            queryClient.invalidateQueries({ queryKey: ["super-agents"] });
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-super"] });
            resetAndClose();
            onComplete?.();
        },
        onError: (err: any) => {
            toast.error(`Erro ao ${isEditMode ? "atualizar" : "criar"} agente: ${err.message}`);
        },
    });

    const resetAndClose = () => {
        setCurrentStep("identity");
        setAgentName("");
        setPersonaName("");
        setBusinessGoal("");
        setAgentType("custom");
        setSelectedIcon("bot");
        setSystemPrompt("");
        setPersonality({ tone: 50, use_emojis: true });
        setEnabledTools(["check_appointments", "check_availability", "schedule_appointment", "get_lead_info"]);
        setTriggerKeywords([]);
        setSelectedInstances([]);
        onOpenChange(false);
    };

    // ─── Navigation ───
    const stepIndex = steps.findIndex((s) => s.key === currentStep);

    const canAdvance = () => {
        if (currentStep === "identity") return agentName.trim().length > 0;
        if (currentStep === "brain") return systemPrompt.trim().length > 0;
        return true;
    };

    const next = () => {
        if (stepIndex < steps.length - 1) setCurrentStep(steps[stepIndex + 1].key);
    };

    const back = () => {
        if (stepIndex > 0) setCurrentStep(steps[stepIndex - 1].key);
    };

    // ─── Render ───
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        {isEditMode ? "Editar Super Agent" : "Criar Super Agent"}
                    </DialogTitle>
                </DialogHeader>

                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 py-3 border-b">
                    {steps.map((step, i) => {
                        const StepIcon = step.icon;
                        const isActive = i === stepIndex;
                        const isComplete = i < stepIndex;
                        return (
                            <div key={step.key} className="flex items-center gap-1">
                                <div
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                        isActive && "bg-primary text-primary-foreground",
                                        isComplete && "bg-primary/20 text-primary",
                                        !isActive && !isComplete && "bg-muted text-muted-foreground"
                                    )}
                                >
                                    {isComplete ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                                    {step.label}
                                </div>
                                {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                    <div className="space-y-6 py-4">
                        {/* ═══ STEP 1: IDENTIDADE ═══ */}
                        {currentStep === "identity" && (
                            <>
                                {/* Quick type selector */}
                                <div>
                                    <Label className="text-sm font-medium mb-2 block">Tipo de Agente</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(["sales", "support", "scheduling", "financial", "technical", "custom"] as const).map((type) => {
                                            const label = type === "custom" ? "Personalizado" : AGENT_PROFILES[type as AgentType]?.name || type;
                                            const isHighlighted = highlightedType === type;
                                            return (
                                                <Card
                                                    key={type}
                                                    className={cn(
                                                        "p-3 cursor-pointer hover:border-primary/50 transition-all text-center",
                                                        agentType === type && "border-primary bg-primary/5",
                                                        isHighlighted && "ring-2 ring-primary ring-offset-2 scale-[1.03]"
                                                    )}
                                                    style={{ transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
                                                    onClick={() => {
                                                        handleTypeSelect(type as AgentType | "custom");
                                                        // Auto-fill the best matching goal for this type
                                                        const typeGoalMap: Record<string, string> = {
                                                            sales: "Vender produtos/serviços e fechar negócios",
                                                            support: "Atender e resolver dúvidas dos clientes",
                                                            scheduling: "Agendar consultas e gerenciar horários",
                                                            financial: "Cobranças, boletos e questões financeiras",
                                                            technical: "Resolver problemas técnicos e dar suporte",
                                                        };
                                                        if (type !== "custom" && typeGoalMap[type]) {
                                                            setBusinessGoal(typeGoalMap[type]);
                                                        }
                                                    }}
                                                >
                                                    <span className="text-sm font-medium">{label}</span>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Name */}
                                <div className="space-y-2">
                                    <Label>Nome do Agente *</Label>
                                    <Input
                                        value={agentName}
                                        onChange={(e) => setAgentName(e.target.value)}
                                        placeholder="Ex: Vendedor Pro"
                                    />
                                </div>

                                {/* Persona */}
                                <div className="space-y-2">
                                    <Label>Nome da Persona</Label>
                                    <Input
                                        value={personaName}
                                        onChange={(e) => setPersonaName(e.target.value)}
                                        placeholder="Ex: Mariana"
                                    />
                                    <p className="text-xs text-muted-foreground">O nome que o agente usará para se apresentar</p>
                                </div>

                                {/* Business Goal */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label>Objetivo do Negócio</Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                                                <p className="font-semibold mb-1">Por que definir o objetivo?</p>
                                                <p>
                                                    O objetivo guia o agente sobre <strong>quando</strong> e <strong>como</strong> abordar cada assunto.
                                                    Por exemplo, um agente de vendas sabe que deve primeiro entender a necessidade do cliente
                                                    antes de apresentar uma oferta — enquanto um agente de suporte foca em resolver o problema
                                                    antes de sugerir upgrades. Quanto mais claro o objetivo, melhor o agente escolhe o momento
                                                    certo para cada abordagem na conversa.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <Input
                                        value={businessGoal}
                                        onChange={(e) => setBusinessGoal(e.target.value)}
                                        placeholder="Digite ou selecione um objetivo abaixo..."
                                    />
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {([
                                            { label: "Vender produtos/serviços e fechar negócios", bestType: "sales" as AgentType },
                                            { label: "Captar leads qualificados e agendar reuniões", bestType: "sales" as AgentType },
                                            { label: "Atender e resolver dúvidas dos clientes", bestType: "support" as AgentType },
                                            { label: "Agendar consultas e gerenciar horários", bestType: "scheduling" as AgentType },
                                            { label: "Qualificar leads e encaminhar para o time comercial", bestType: "sales" as AgentType },
                                            { label: "Recuperar clientes inativos e reengajar", bestType: "sales" as AgentType },
                                            { label: "Resolver problemas técnicos e dar suporte", bestType: "technical" as AgentType },
                                            { label: "Cobranças, boletos e questões financeiras", bestType: "financial" as AgentType },
                                        ]).map((suggestion) => {
                                            const isSelected = businessGoal === suggestion.label;
                                            const currentNormalized = agentType === "custom" ? null : agentType;
                                            const isMismatch = isSelected && currentNormalized && currentNormalized !== suggestion.bestType;
                                            return (
                                                <Badge
                                                    key={suggestion.label}
                                                    variant={isSelected ? "default" : "outline"}
                                                    className={cn(
                                                        "cursor-pointer text-xs py-1 px-2.5 transition-all hover:bg-primary/10 hover:border-primary/50",
                                                        isSelected && "bg-primary text-primary-foreground",
                                                        isMismatch && "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                                                    )}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setBusinessGoal("");
                                                            return;
                                                        }
                                                        setBusinessGoal(suggestion.label);
                                                        // Auto-switch agent type if it doesn't match
                                                        if (currentNormalized !== suggestion.bestType) {
                                                            handleTypeSelect(suggestion.bestType);
                                                            // Visual pulse on the newly selected type card
                                                            setHighlightedType(suggestion.bestType);
                                                            setTimeout(() => setHighlightedType(null), 800);
                                                        }
                                                    }}
                                                >
                                                    {suggestion.label}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Icon */}
                                <div>
                                    <Label className="text-sm mb-2 block">Ícone</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {iconOptions.map((opt) => {
                                            const IconComp = opt.icon;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSelectedIcon(opt.id)}
                                                    className={cn(
                                                        "p-2 rounded-lg border transition-all",
                                                        selectedIcon === opt.id
                                                            ? "border-primary bg-primary/10 text-primary"
                                                            : "border-border hover:border-primary/30"
                                                    )}
                                                >
                                                    <IconComp className="h-4 w-4" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ═══ STEP 2: CÉREBRO ═══ */}
                        {currentStep === "brain" && (
                            <>
                                {/* System Prompt — protagonist */}
                                <div className="space-y-2">
                                    <Label className="text-base font-semibold flex items-center gap-2">
                                        <Brain className="h-4 w-4 text-primary" />
                                        Prompt do Agente *
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        O comportamento central do seu agente. Escreva TUDO que ele precisa saber e como deve se comportar.
                                        As regras de segurança (não inventar dados, não revelar que é IA) são adicionadas automaticamente.
                                    </p>
                                    <Textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        placeholder={`Você é ${personaName || "um assistente"} especialista em ${agentType !== "custom" ? agentType : "atendimento"}. Seu objetivo é:\n\n- Identificar as necessidades do cliente\n- Apresentar soluções relevantes\n- Ser proativo e conciso\n- Fechar a venda / resolver o problema`}
                                        className="min-h-[200px] font-mono text-sm"
                                    />
                                </div>

                                {/* Personality — compact */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm">Tom: {personality.tone < 30 ? "Formal" : personality.tone > 70 ? "Descontraído" : "Equilibrado"}</Label>
                                        <Slider
                                            value={[personality.tone]}
                                            onValueChange={([v]) => setPersonality((p) => ({ ...p, tone: v }))}
                                            min={0}
                                            max={100}
                                            step={10}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pt-5">
                                        <Switch
                                            checked={personality.use_emojis}
                                            onCheckedChange={(v) => setPersonality((p) => ({ ...p, use_emojis: v }))}
                                        />
                                        <Label className="text-sm">Usar emojis</Label>
                                    </div>
                                </div>

                                {/* Tools */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        <Wrench className="h-4 w-4" />
                                        Ferramentas
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Ferramentas que o agente pode usar proativamente durante as conversas.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {availableTools.map((tool) => {
                                            const ToolIcon = tool.icon;
                                            const isEnabled = enabledTools.includes(tool.id);
                                            return (
                                                <Card
                                                    key={tool.id}
                                                    className={cn(
                                                        "p-3 cursor-pointer transition-all",
                                                        isEnabled ? "border-primary bg-primary/5" : "opacity-60 hover:opacity-100"
                                                    )}
                                                    onClick={() => toggleTool(tool.id)}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <Checkbox checked={isEnabled} className="mt-0.5" />
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <ToolIcon className="h-3.5 w-3.5 text-primary" />
                                                                <span className="text-sm font-medium">{tool.label}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Keywords */}
                                <div className="space-y-2">
                                    <Label className="text-sm">Palavras-chave de ativação</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={keywordInput}
                                            onChange={(e) => setKeywordInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                                            placeholder="Ex: vendas, preço, comprar..."
                                            className="flex-1"
                                        />
                                        <Button variant="outline" size="sm" onClick={addKeyword}>Adicionar</Button>
                                    </div>
                                    {triggerKeywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {triggerKeywords.map((kw) => (
                                                <Badge
                                                    key={kw}
                                                    variant="secondary"
                                                    className="cursor-pointer hover:bg-destructive/20"
                                                    onClick={() => removeKeyword(kw)}
                                                >
                                                    {kw} ×
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ═══ STEP 3: APLICAR ═══ */}
                        {currentStep === "apply" && (
                            <>
                                {/* Summary */}
                                <Card className="p-4 bg-primary/5 border-primary/20">
                                    <div className="flex items-center gap-3">
                                        {(() => { const Ic = getIconComponent(selectedIcon); return <Ic className="h-8 w-8 text-primary" />; })()}
                                        <div>
                                            <h3 className="font-semibold">{agentName}</h3>
                                            {personaName && <p className="text-sm text-muted-foreground">Persona: {personaName}</p>}
                                            <div className="flex gap-1.5 mt-1">
                                                <Badge variant="outline" className="text-xs">Super Agent</Badge>
                                                <Badge variant="outline" className="text-xs">{enabledTools.length} ferramentas</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* Prompt preview */}
                                <div className="space-y-1">
                                    <Label className="text-sm">Preview do Prompt</Label>
                                    <pre className="text-xs bg-muted p-3 rounded-lg max-h-[120px] overflow-auto whitespace-pre-wrap font-mono">
                                        {systemPrompt.replace(/{persona}/g, personaName || agentName).slice(0, 500)}
                                        {systemPrompt.length > 500 && "..."}
                                    </pre>
                                </div>

                                {/* Instance selection */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Aplicar em qual instância WhatsApp?</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Selecione as instâncias que usarão este Super Agent. As instâncias selecionadas serão automaticamente
                                        trocadas do modo legacy para o modo Super Agent.
                                    </p>
                                    {instances.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">Nenhuma instância WhatsApp encontrada.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {instances.map((inst: any) => (
                                                <Card
                                                    key={inst.id}
                                                    className={cn(
                                                        "p-3 cursor-pointer transition-all",
                                                        selectedInstances.includes(inst.id) && "border-primary bg-primary/5"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedInstances((prev) =>
                                                            prev.includes(inst.id)
                                                                ? prev.filter((id) => id !== inst.id)
                                                                : [...prev, inst.id]
                                                        );
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox checked={selectedInstances.includes(inst.id)} />
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium">{inst.display_name || inst.phone || "Instância"}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Engine atual: {inst.agent_engine || "legacy"}
                                                                {inst.super_agent_id && " (já tem super agent)"}
                                                            </p>
                                                        </div>
                                                        <Badge variant={inst.status === "connected" ? "default" : "secondary"} className="text-xs">
                                                            {inst.status || "offline"}
                                                        </Badge>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                    <Button variant="ghost" onClick={back} disabled={stepIndex === 0}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Voltar
                    </Button>

                    {currentStep !== "apply" ? (
                        <Button onClick={next} disabled={!canAdvance()}>
                            Próximo
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                            className="gap-2"
                        >
                            {saveMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {isEditMode ? "Salvando..." : "Criando..."}
                                </>
                            ) : (
                                <>
                                    <Rocket className="h-4 w-4" />
                                    {isEditMode ? "Salvar Alterações" : "Criar Super Agent"}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
