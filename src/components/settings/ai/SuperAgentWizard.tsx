import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Bot, User, Heart, Star, Zap, Sparkles, Shield, Target,
    Award, Crown, Lightbulb, Rocket, Coffee, MessageCircle,
    Loader2, ChevronRight, ChevronLeft, Check, ArrowLeft,
    Wrench, Brain, Calendar, Search, UserCheck, Info,
    HelpCircle, Wand2, Eye,
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

const getIconComponent = (id: string) => iconOptions.find((o) => o.id === id)?.icon || Bot;

// ─── Available Tools ───
const availableTools = [
    { id: "check_appointments", label: "Consultar Agendamentos", icon: Calendar, description: "Busca os agendamentos existentes do cliente" },
    { id: "check_availability", label: "Verificar Disponibilidade", icon: Search, description: "Consulta horários livres para novos agendamentos" },
    { id: "schedule_appointment", label: "Agendar", icon: Calendar, description: "Cria um novo agendamento para o cliente" },
    { id: "get_lead_info", label: "Info do Cliente", icon: UserCheck, description: "Busca dados cadastrais do cliente" },
];

// ─── Types ───
type WizardStep = "type" | "identity" | "brain" | "apply";

interface SuperAgentWizardProps {
    workspaceId: string;
    onComplete?: () => void;
    onCancel: () => void;
    editAgent?: any;
}

const steps: { key: WizardStep; label: string; icon: React.ElementType; description: string }[] = [
    { key: "type", label: "Tipo", icon: Sparkles, description: "Escolha o perfil do agente" },
    { key: "identity", label: "Identidade", icon: User, description: "Nome e personalidade" },
    { key: "brain", label: "Cérebro", icon: Brain, description: "Prompt e ferramentas" },
    { key: "apply", label: "Ativar", icon: Zap, description: "Vincular às instâncias" },
];

// ─── Component ───
export const SuperAgentWizard = ({
    workspaceId,
    onComplete,
    onCancel,
    editAgent,
}: SuperAgentWizardProps) => {
    const isEditMode = !!editAgent;
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState<WizardStep>(isEditMode ? "identity" : "type");

    // ─── Identity State ───
    const [agentName, setAgentName] = useState("");
    const [personaName, setPersonaName] = useState("");
    const [businessGoal, setBusinessGoal] = useState("");
    const [agentType, setAgentType] = useState<AgentType | "custom">("custom");
    const [selectedIcon, setSelectedIcon] = useState("bot");
    const [showIconPicker, setShowIconPicker] = useState(false);

    // ─── Brain State ───
    const [systemPrompt, setSystemPrompt] = useState("");
    const [personality, setPersonality] = useState({ tone: 50, use_emojis: true });
    const [enabledTools, setEnabledTools] = useState<string[]>([
        "check_appointments", "check_availability", "schedule_appointment", "get_lead_info",
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
        enabled: !!workspaceId,
    });

    // Pre-fill state when editing
    useEffect(() => {
        if (editAgent) {
            setAgentName(editAgent.name || "");
            setPersonaName(editAgent.persona_name || "");
            setBusinessGoal(editAgent.behavior?.business_goal || "");
            setAgentType(editAgent.agent_type || "custom");
            setSelectedIcon(editAgent.icon || "bot");
            setSystemPrompt(editAgent.system_prompt || "");
            setPersonality(editAgent.personality || { tone: 50, use_emojis: true });
            setEnabledTools(editAgent.enabled_tools || []);
            setTriggerKeywords(editAgent.trigger_keywords || []);
            const linkedIds = (instances || []).filter((i: any) => i.super_agent_id === editAgent.id).map((i: any) => i.id);
            setSelectedInstances(linkedIds);
        }
    }, [editAgent, instances]);

    // Pre-fill from agent profile
    const handleTypeSelect = (type: AgentType | "custom") => {
        setAgentType(type);
        if (type !== "custom") {
            const profile = AGENT_PROFILES[type];
            setAgentName(profile.name);
            setSelectedIcon(profile.iconId || "bot");
            setPersonality({ tone: profile.personality.tone, use_emojis: profile.personality.use_emojis });
            setSystemPrompt(profile.system_prompt);
            setTriggerKeywords(profile.trigger_keywords);
            if (profile.suggested_personas.length > 0) {
                setPersonaName(profile.suggested_personas[Math.floor(Math.random() * profile.suggested_personas.length)]);
            }
        } else {
            setAgentName("");
            setPersonaName("");
            setSystemPrompt("");
            setTriggerKeywords([]);
        }
        // Auto-advance after selection
        setTimeout(() => setCurrentStep("identity"), 300);
    };

    // Tool toggle
    const toggleTool = (toolId: string) => {
        setEnabledTools((prev) =>
            prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
        );
    };

    // Keyword management  
    const addKeyword = () => {
        const kw = keywordInput.trim().toLowerCase();
        if (kw && !triggerKeywords.includes(kw)) {
            setTriggerKeywords((prev) => [...prev, kw]);
            setKeywordInput("");
        }
    };
    const removeKeyword = (kw: string) => setTriggerKeywords((prev) => prev.filter((k) => k !== kw));

    // ─── Save Mutation ───
    const saveMutation = useMutation({
        mutationFn: async () => {
            const agentData = {
                workspace_id: workspaceId,
                name: agentName,
                persona_name: personaName || null,
                agent_type: agentType === "custom" ? null : agentType,
                icon: selectedIcon,
                system_prompt: systemPrompt,
                personality,
                behavior: { business_goal: businessGoal },
                enabled_tools: enabledTools,
                trigger_keywords: triggerKeywords,
                is_active: true,
            };

            if (isEditMode) {
                const { error: agentError } = await supabase
                    .from("super_agents")
                    .update(agentData)
                    .eq("id", editAgent.id);
                if (agentError) throw agentError;

                // Update linked instances
                await supabase
                    .from("whatsapp_instances")
                    .update({ agent_engine: "super_agent", super_agent_id: editAgent.id })
                    .in("id", selectedInstances);

                // Unlink removed instances
                await supabase
                    .from("whatsapp_instances")
                    .update({ agent_engine: null, super_agent_id: null })
                    .eq("super_agent_id", editAgent.id)
                    .not("id", "in", `(${selectedInstances.join(",")})`);
            } else {
                const { data: superAgent, error: saError } = await supabase
                    .from("super_agents")
                    .insert(agentData)
                    .select()
                    .single();
                if (saError) throw saError;

                if (selectedInstances.length > 0) {
                    await supabase
                        .from("whatsapp_instances")
                        .update({ agent_engine: "super_agent", super_agent_id: superAgent.id })
                        .in("id", selectedInstances);
                }
            }
        },
        onSuccess: () => {
            toast.success(isEditMode ? "Agente atualizado!" : "Agente criado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["super-agents"] });
            queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
            onComplete?.();
        },
        onError: (err: any) => {
            toast.error(`Erro: ${err.message}`);
        },
    });

    // ─── Navigation ───
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
    const canAdvance = () => {
        if (currentStep === "type") return agentType !== "custom" || agentName.length > 0;
        if (currentStep === "identity") return agentName.length >= 2;
        if (currentStep === "brain") return systemPrompt.length >= 10;
        return true;
    };
    const next = () => { if (stepIndex < steps.length - 1) setCurrentStep(steps[stepIndex + 1].key); };
    const back = () => { if (stepIndex > 0) setCurrentStep(steps[stepIndex - 1].key); };

    const toneLabel = personality.tone < 30 ? "Formal" : personality.tone > 70 ? "Descontraído" : "Equilibrado";
    const SelectedIconComp = getIconComponent(selectedIcon);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Header with back button */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onCancel} className="shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        {isEditMode ? "Editar Agente" : "Criar novo Agente"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {steps[stepIndex]?.description}
                    </p>
                </div>
            </div>

            {/* Step progress bar */}
            <div className="flex items-center gap-1">
                {steps.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = i === stepIndex;
                    const isComplete = i < stepIndex;
                    return (
                        <div key={step.key} className="flex items-center gap-1 flex-1">
                            <button
                                onClick={() => isComplete && setCurrentStep(step.key)}
                                disabled={!isComplete}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full justify-center",
                                    isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                                    isComplete && "bg-primary/15 text-primary cursor-pointer hover:bg-primary/25",
                                    !isActive && !isComplete && "bg-muted/50 text-muted-foreground"
                                )}
                            >
                                {isComplete ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{step.label}</span>
                            </button>
                            {i < steps.length - 1 && (
                                <ChevronRight className={cn("h-4 w-4 shrink-0", i < stepIndex ? "text-primary" : "text-muted-foreground/30")} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP 1: TIPO DO AGENTE                           */}
            {/* ═══════════════════════════════════════════════ */}
            {currentStep === "type" && (
                <div className="space-y-5 animate-in fade-in duration-200">
                    {/* Tip banner */}
                    <Card className="p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-violet-500/5 border-primary/20">
                        <div className="flex gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 shrink-0 h-fit">
                                <Wand2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Escolha um perfil para começar</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Cada perfil já vem pré-configurado com prompt, tom de voz e gatilhos otimizados.
                                    Você pode personalizar tudo depois!
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Agent type cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(["sales", "support", "scheduling", "financial", "technical", "general"] as AgentType[]).map((type) => {
                            const profile = AGENT_PROFILES[type];
                            const ProfileIcon = profile.icon;
                            const isSelected = agentType === type;
                            return (
                                <Card
                                    key={type}
                                    className={cn(
                                        "p-4 cursor-pointer transition-all hover:shadow-md group relative overflow-hidden",
                                        isSelected && "border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10"
                                    )}
                                    onClick={() => handleTypeSelect(type)}
                                >
                                    <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-10 transition-opacity group-hover:opacity-20"
                                        style={{ backgroundColor: profile.color }}
                                    />
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${profile.color}15`, color: profile.color }}>
                                            <ProfileIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm">{profile.name}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{profile.description}</p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2">
                                            <Check className="h-4 w-4 text-primary" />
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>

                    {/* Custom option */}
                    <div className="flex justify-center">
                        <Button
                            variant="ghost"
                            className="text-sm text-muted-foreground hover:text-foreground gap-2"
                            onClick={() => { setAgentType("custom"); setCurrentStep("identity"); }}
                        >
                            <Sparkles className="h-4 w-4" />
                            Quero criar do zero (personalizado)
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP 2: IDENTIDADE                                */}
            {/* ═══════════════════════════════════════════════ */}
            {currentStep === "identity" && (
                <div className="space-y-5 animate-in fade-in duration-200">

                    {/* Tip */}
                    <Card className="p-4 bg-gradient-to-r from-blue-500/5 via-sky-500/5 to-cyan-500/5 border-blue-500/20">
                        <div className="flex gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0 h-fit">
                                <HelpCircle className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Dê uma identidade ao seu agente</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    O <strong>nome do agente</strong> é como ele aparece pra você na plataforma.
                                    A <strong>persona</strong> é o personagem que o cliente vai interagir — tipo
                                    "Mariana da equipe de Vendas". Isso humaniza a conversa!
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Icon + Agent Name row */}
                    <div className="flex gap-3 items-start">
                        {/* Icon picker */}
                        <div className="shrink-0">
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Ícone</Label>
                            <button
                                onClick={() => setShowIconPicker(!showIconPicker)}
                                className={cn(
                                    "w-14 h-14 rounded-xl flex items-center justify-center transition-all border-2",
                                    "bg-primary/10 text-primary border-primary/20 hover:border-primary/40 hover:shadow-md"
                                )}
                            >
                                <SelectedIconComp className="h-7 w-7" />
                            </button>
                        </div>

                        {/* Agent name */}
                        <div className="flex-1 space-y-1.5">
                            <Label className="text-sm">Nome do Agente *</Label>
                            <Input
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="Ex: Vendedor Principal, Atendente VIP..."
                                className="h-11"
                            />
                        </div>
                    </div>

                    {/* Icon grid (expandable) */}
                    {showIconPicker && (
                        <Card className="p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-8 gap-1.5">
                                {iconOptions.map((opt) => {
                                    const Ic = opt.icon;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setSelectedIcon(opt.id); setShowIconPicker(false); }}
                                            className={cn(
                                                "p-2 rounded-lg transition-all hover:bg-primary/10",
                                                selectedIcon === opt.id && "bg-primary/20 ring-2 ring-primary"
                                            )}
                                        >
                                            <Ic className="h-5 w-5 mx-auto" />
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Persona Name */}
                    <div className="space-y-1.5">
                        <Label className="text-sm flex items-center gap-2">
                            Persona (nome fictício)
                            <Badge variant="outline" className="text-[10px] font-normal">Recomendado</Badge>
                        </Label>
                        <Input
                            value={personaName}
                            onChange={(e) => setPersonaName(e.target.value)}
                            placeholder="Ex: Mariana, Carlos, Sofia..."
                        />
                        <p className="text-xs text-muted-foreground">
                            O agente se apresentará com esse nome para o cliente. Deixe vazio se preferir sem persona.
                        </p>
                    </div>

                    {/* Business goal */}
                    <div className="space-y-1.5">
                        <Label className="text-sm">Objetivo principal</Label>
                        <Input
                            value={businessGoal}
                            onChange={(e) => setBusinessGoal(e.target.value)}
                            placeholder="Ex: Vender planos odontológicos, Agendar consultas..."
                        />
                    </div>

                    {/* Personality quick settings */}
                    <Card className="p-4 space-y-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Personalidade
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                    Tom de voz: <span className="font-medium text-foreground">{toneLabel}</span>
                                </Label>
                                <Slider
                                    value={[personality.tone]}
                                    onValueChange={([v]) => setPersonality((p) => ({ ...p, tone: v }))}
                                    min={0} max={100} step={10}
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Formal</span>
                                    <span>Descontraído</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 sm:pt-4">
                                <Switch
                                    checked={personality.use_emojis}
                                    onCheckedChange={(v) => setPersonality((p) => ({ ...p, use_emojis: v }))}
                                />
                                <div>
                                    <Label className="text-sm">Usar emojis</Label>
                                    <p className="text-xs text-muted-foreground">Torna a conversa mais leve 😊</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP 3: CÉREBRO                                   */}
            {/* ═══════════════════════════════════════════════ */}
            {currentStep === "brain" && (
                <div className="space-y-5 animate-in fade-in duration-200">

                    {/* Tip */}
                    <Card className="p-4 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 border-violet-500/20">
                        <div className="flex gap-3">
                            <div className="p-2 rounded-lg bg-violet-500/10 shrink-0 h-fit">
                                <Brain className="h-5 w-5 text-violet-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">O prompt é o coração do agente</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Escreva <strong>tudo</strong> que seu agente precisa saber: como se comportar,
                                    quais serviços oferecer, o que nunca dizer, e qual o tom da
                                    conversa. Quanto mais detalhado, melhor! As regras de segurança
                                    (não inventar dados, etc.) são adicionadas automaticamente.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* System Prompt */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            Prompt do Agente *
                        </Label>
                        <Textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder={`Você é ${personaName || "um assistente"} especialista em ${agentType !== "custom" ? agentType : "atendimento"}. Seu objetivo é:\n\n- Identificar as necessidades do cliente\n- Apresentar soluções relevantes\n- Ser proativo e conciso\n- Fechar a venda / resolver o problema`}
                            className="min-h-[200px] font-mono text-sm"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{systemPrompt.length} caracteres</span>
                            <span>{systemPrompt.length < 50 ? "💡 Recomendado: pelo menos 100 caracteres" : "✅ Bom tamanho!"}</span>
                        </div>
                    </div>

                    {/* Tools */}
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-primary" />
                                Ferramentas
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                O agente usará estas ferramentas proativamente durante as conversas para buscar informações reais.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableTools.map((tool) => {
                                const ToolIcon = tool.icon;
                                const isEnabled = enabledTools.includes(tool.id);
                                return (
                                    <Card
                                        key={tool.id}
                                        className={cn(
                                            "p-3 cursor-pointer transition-all",
                                            isEnabled
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "opacity-60 hover:opacity-100 hover:border-muted-foreground/30"
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
                        <p className="text-xs text-muted-foreground">
                            Quando o cliente enviar uma dessas palavras, este agente será ativado automaticamente (usado no roteamento multi-agente).
                        </p>
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
                                        className="cursor-pointer hover:bg-destructive/20 transition-colors"
                                        onClick={() => removeKeyword(kw)}
                                    >
                                        {kw} ×
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP 4: APLICAR                                   */}
            {/* ═══════════════════════════════════════════════ */}
            {currentStep === "apply" && (
                <div className="space-y-5 animate-in fade-in duration-200">

                    {/* Summary card */}
                    <Card className="p-5 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 border-primary/20">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                <SelectedIconComp className="h-8 w-8" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">{agentName || "Sem nome"}</h3>
                                {personaName && <p className="text-sm text-muted-foreground">Persona: {personaName}</p>}
                                <div className="flex gap-1.5 mt-1.5">
                                    <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px]">
                                        SUPER AGENT
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                        {enabledTools.length} ferramentas
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                        {toneLabel}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Prompt preview */}
                    <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Preview do prompt
                        </Label>
                        <pre className="text-xs bg-muted p-3 rounded-lg max-h-[120px] overflow-auto whitespace-pre-wrap font-mono border">
                            {systemPrompt.replace(/{persona}/g, personaName || agentName).slice(0, 500)}
                            {systemPrompt.length > 500 && "..."}
                        </pre>
                    </div>

                    {/* Instance selection */}
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold">Vincular a qual instância WhatsApp?</Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Selecione as instâncias que usarão este agente. Você pode mudar isso depois.
                            </p>
                        </div>
                        {instances.length === 0 ? (
                            <Card className="p-4 text-center border-dashed">
                                <p className="text-sm text-muted-foreground">Nenhuma instância WhatsApp encontrada.</p>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {instances.map((inst: any) => (
                                    <Card
                                        key={inst.id}
                                        className={cn(
                                            "p-3 cursor-pointer transition-all hover:shadow-sm",
                                            selectedInstances.includes(inst.id) && "border-primary bg-primary/5 shadow-sm"
                                        )}
                                        onClick={() => {
                                            setSelectedInstances((prev) =>
                                                prev.includes(inst.id) ? prev.filter((id) => id !== inst.id) : [...prev, inst.id]
                                            );
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Checkbox checked={selectedInstances.includes(inst.id)} />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{inst.display_name || inst.phone || "Instância"}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {inst.super_agent_id && inst.super_agent_id !== editAgent?.id
                                                        ? "⚠️ Já tem outro agente vinculado"
                                                        : inst.agent_engine === "super_agent" ? "Com agente" : "Sem agente"}
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
                </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* Footer navigation                                */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="flex items-center justify-between pt-4 border-t">
                <Button
                    variant="ghost"
                    onClick={currentStep === "type" ? onCancel : back}
                    className="gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    {currentStep === "type" ? "Cancelar" : "Voltar"}
                </Button>

                {currentStep !== "apply" ? (
                    <Button onClick={next} disabled={!canAdvance()} className="gap-1">
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="gap-2 bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/25"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {isEditMode ? "Salvando..." : "Criando..."}
                            </>
                        ) : (
                            <>
                                <Rocket className="h-4 w-4" />
                                {isEditMode ? "Salvar Alterações" : "Criar Agente"}
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
};
