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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
    Bot, User, Heart, Star, Zap, Sparkles, Shield, Target,
    Award, Crown, Lightbulb, Rocket, Coffee, MessageCircle,
    Loader2, ChevronRight, ChevronLeft, Check, ArrowLeft,
    Wrench, Brain, Calendar, Search, UserCheck, Info,
    HelpCircle, Wand2, Eye, BookOpen, StickyNote, PhoneForwarded,
    FileText, Lock, Package, CalendarX, History, Truck,
    CreditCard, FolderInput, ClipboardList, MessageSquare,
    Smile, Mic, Globe,
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

// ─── Core Tools (always active for all agents) ───
const coreTools = [
    { id: "get_lead_info", label: "Info do Cliente", icon: UserCheck, description: "Busca dados cadastrais do cliente" },
    { id: "create_update_lead", label: "Criar/Atualizar Lead", icon: User, description: "Captura e atualiza dados do cliente automaticamente" },
    { id: "transfer_to_human", label: "Transferir p/ Humano", icon: PhoneForwarded, description: "Escala a conversa para atendimento humano" },
    { id: "search_knowledge_base", label: "Buscar Conhecimento", icon: BookOpen, description: "Consulta a base de conhecimento para respostas precisas" },
    { id: "register_note", label: "Registrar Nota", icon: StickyNote, description: "Adiciona observações e notas ao perfil do cliente" },
];

const coreToolIds = coreTools.map(t => t.id);

// ─── Optional Tools (toggleable per agent) ───
const optionalTools = [
    // 🔥 Alto impacto
    { id: "check_appointments", label: "Consultar Agendamentos", icon: Calendar, description: "Busca os agendamentos existentes do cliente" },
    { id: "check_availability", label: "Verificar Disponibilidade", icon: Search, description: "Consulta horários livres para novos agendamentos" },
    { id: "schedule_appointment", label: "Agendar", icon: Calendar, description: "Cria um novo agendamento para o cliente" },
    { id: "cancel_reschedule", label: "Cancelar/Reagendar", icon: CalendarX, description: "Cancela ou move um agendamento existente" },
    { id: "send_quote", label: "Enviar Orçamento", icon: FileText, description: "Gera e envia um orçamento com base nos serviços discutidos" },
    { id: "query_products", label: "Consultar Produtos", icon: Package, description: "Busca no catálogo (preço, disponibilidade, descrição)" },
    // 💡 Médio impacto
    { id: "check_conversation_history", label: "Histórico de Conversas", icon: History, description: "Busca conversas anteriores do cliente para contexto" },
    { id: "check_order_status", label: "Status de Pedido", icon: Package, description: "Consulta status de pedidos para e-commerce/delivery" },
    { id: "send_payment_link", label: "Link de Pagamento", icon: CreditCard, description: "Gera um link de pagamento (PIX, Stripe, etc.)" },
    { id: "calculate_shipping", label: "Calcular Frete", icon: Truck, description: "Calcula frete e prazo de entrega" },
    // 🚀 Avançado
    { id: "summarize_conversation", label: "Resumir Conversa", icon: MessageSquare, description: "Gera um resumo da conversa para handoff humano" },
    { id: "create_followup_task", label: "Tarefa de Follow-up", icon: ClipboardList, description: "Agenda um lembrete para recontatar o cliente" },
];

// ─── Types ───
type WizardStep = "type" | "identity" | "brain" | "tools" | "apply";

interface SuperAgentWizardProps {
    workspaceId: string;
    onComplete?: () => void;
    onCancel: () => void;
    editAgent?: any;
}

const steps: { key: WizardStep; label: string; icon: React.ElementType; description: string }[] = [
    { key: "type", label: "Tipo", icon: Sparkles, description: "Escolha o perfil do agente" },
    { key: "identity", label: "Identidade", icon: User, description: "Nome e personalidade" },
    { key: "brain", label: "Cérebro", icon: Brain, description: "Prompt e comportamento" },
    { key: "tools", label: "Ferramentas", icon: Wrench, description: "Habilidades do agente" },
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
    const [personality, setPersonality] = useState({
        tone: 50, use_emojis: true, verbosity: 50, proactivity: 70,
        language: "pt-BR", response_speed: "simulated",
        use_slang: false, formal_names: false, use_audio: false,
    });
    const [enabledTools, setEnabledTools] = useState<string[]>([
        "check_appointments", "check_availability", "schedule_appointment", "send_quote",
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
            setPersonality({
                tone: 50, use_emojis: true, verbosity: 50, proactivity: 70,
                language: "pt-BR", response_speed: "simulated",
                use_slang: false, formal_names: false, use_audio: false,
                ...(editAgent.personality || {}),
            });
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
            setPersonality((prev) => ({
                ...prev,
                tone: profile.personality.tone,
                use_emojis: profile.personality.use_emojis,
                verbosity: profile.personality.verbosity ?? 50,
                proactivity: profile.personality.proactivity ?? 70,
            }));
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
                enabled_tools: [...coreToolIds, ...enabledTools.filter(t => !coreToolIds.includes(t))],
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
    const verbosityLabel = personality.verbosity < 30 ? "Curto" : personality.verbosity > 70 ? "Detalhado" : "Moderado";
    const proactivityLabel = personality.proactivity < 30 ? "Reativo" : personality.proactivity > 70 ? "Proativo" : "Equilibrado";
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
                    const isNavigable = isEditMode ? !isActive : isComplete;
                    return (
                        <div key={step.key} className="flex items-center gap-1 flex-1">
                            <button
                                onClick={() => isNavigable && setCurrentStep(step.key)}
                                disabled={!isNavigable}
                                className={cn(
                                    "flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all w-full justify-center",
                                    isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                                    isComplete && !isActive && "bg-primary/15 text-primary cursor-pointer hover:bg-primary/25",
                                    !isActive && !isComplete && isNavigable && "bg-muted/80 text-foreground/70 cursor-pointer hover:bg-muted",
                                    !isActive && !isComplete && !isNavigable && "bg-muted/50 text-muted-foreground"
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

                    {/* Live Agent Preview Card */}
                    <Card className="p-0 overflow-hidden border-0 shadow-xl">
                        <div className="relative bg-gradient-to-br from-gray-100 via-slate-200 to-gray-100 dark:from-slate-800 dark:via-slate-700 dark:to-zinc-800 p-6">
                            {/* Subtle glow */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.02),transparent_60%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.04),transparent_60%)]" />

                            <div className="relative flex items-start gap-5">
                                {/* Icon picker — always shows edit hint */}
                                <button
                                    onClick={() => setShowIconPicker(!showIconPicker)}
                                    className="relative group shrink-0"
                                >
                                    <div className={cn(
                                        "w-[72px] h-[72px] rounded-2xl flex items-center justify-center transition-all border-2",
                                        "bg-slate-500/10 dark:bg-white/10 backdrop-blur-md border-slate-300 dark:border-white/20 group-hover:border-slate-400 dark:group-hover:border-white/50 group-hover:scale-105 shadow-lg shadow-black/5 dark:shadow-black/10"
                                    )}>
                                        <SelectedIconComp className="h-9 w-9 text-slate-700 dark:text-white" />
                                    </div>
                                    <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white dark:bg-white shadow-md flex items-center justify-center transition-transform group-hover:scale-110">
                                        <Wand2 className="h-3 w-3 text-slate-600 dark:text-violet-600" />
                                    </div>
                                </button>

                                {/* Agent info */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <h3 className="text-slate-800 dark:text-white font-bold text-xl leading-tight truncate">
                                        {agentName || "Nome do Agente"}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {personaName ? (
                                            <span className="text-xs bg-slate-500/10 dark:bg-white/15 text-slate-600 dark:text-white/90 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                                                {personaName}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400 dark:text-white/50 italic">Sem persona</span>
                                        )}
                                        <span className="text-xs text-slate-300 dark:text-white/40">•</span>
                                        <span className="text-xs text-slate-500 dark:text-white/50">{toneLabel}</span>
                                    </div>
                                    {businessGoal && (
                                        <p className="text-slate-400 dark:text-white/50 text-xs mt-2 flex items-center gap-1.5 truncate">
                                            <Target className="h-3 w-3 shrink-0" />
                                            {businessGoal}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-2 bg-muted/40 border-t border-border/30 flex items-center justify-between">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <Eye className="h-3 w-3" />
                                Preview em tempo real
                            </p>
                            <div className="flex items-center gap-2">
                                {personality.use_emojis && <span className="text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">Emojis</span>}
                                {personality.use_audio && <span className="text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">Áudio</span>}
                                <span className="text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">
                                    {personality.language === "auto" ? "Multi-idioma" : personality.language === "pt-BR" ? "PT-BR" : personality.language === "es" ? "ES" : "EN"}
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Icon grid (expandable) */}
                    {showIconPicker && (
                        <Card className="p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-xs text-muted-foreground mb-2">Escolha um ícone para o agente</p>
                            <div className="grid grid-cols-8 gap-1.5">
                                {iconOptions.map((opt) => {
                                    const Ic = opt.icon;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => { setSelectedIcon(opt.id); setShowIconPicker(false); }}
                                            className={cn(
                                                "p-2.5 rounded-xl transition-all hover:bg-primary/10 hover:scale-105",
                                                selectedIcon === opt.id && "bg-primary/20 ring-2 ring-primary shadow-sm"
                                            )}
                                        >
                                            <Ic className="h-5 w-5 mx-auto" />
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {/* Agent Name + Persona in 2 columns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Bot className="h-3.5 w-3.5 text-primary" />
                                Nome do Agente *
                            </Label>
                            <Input
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="Ex: Vendedor Principal..."
                                className="h-11"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Visível só pra você na plataforma
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-violet-500" />
                                Persona
                                <Badge variant="outline" className="text-[10px] font-normal ml-1">Recomendado</Badge>
                            </Label>
                            <Input
                                value={personaName}
                                onChange={(e) => setPersonaName(e.target.value)}
                                placeholder="Ex: Mariana, Carlos..."
                                className="h-11"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                O cliente conversa com esse nome
                            </p>
                        </div>
                    </div>

                    {/* Business goal */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                            <Target className="h-3.5 w-3.5 text-amber-500" />
                            Objetivo principal
                        </Label>
                        <Input
                            value={businessGoal}
                            onChange={(e) => setBusinessGoal(e.target.value)}
                            placeholder="Ex: Vender planos odontológicos, Agendar consultas, Suporte técnico..."
                            className="h-11"
                        />
                        {/* Goal suggestions based on agent type */}
                        {(() => {
                            const goalSuggestions: Record<string, string[]> = {
                                sales: [
                                    "Vender planos e serviços",
                                    "Converter leads em clientes",
                                    "Apresentar produtos e preços",
                                    "Negociar e fechar vendas",
                                ],
                                support: [
                                    "Resolver dúvidas dos clientes",
                                    "Atendimento ao cliente",
                                    "Orientar sobre serviços",
                                    "Resolver reclamações",
                                ],
                                scheduling: [
                                    "Agendar consultas",
                                    "Gerenciar agendamentos",
                                    "Remarcar e cancelar horários",
                                    "Confirmar agendamentos",
                                ],
                                financial: [
                                    "Enviar boletos e faturas",
                                    "Tirar dúvidas sobre pagamentos",
                                    "Negociar débitos",
                                    "Orientar formas de pagamento",
                                ],
                                technical: [
                                    "Resolver problemas técnicos",
                                    "Orientar configurações",
                                    "Suporte técnico passo a passo",
                                    "Diagnosticar e corrigir erros",
                                ],
                                general: [
                                    "Atendimento geral ao cliente",
                                    "Responder dúvidas frequentes",
                                    "Direcionar para o setor correto",
                                    "Coletar informações do cliente",
                                ],
                                custom: [
                                    "Atendimento personalizado",
                                    "Vender produtos e serviços",
                                    "Agendar horários",
                                    "Suporte ao cliente",
                                ],
                            };
                            const suggestions = goalSuggestions[agentType] || goalSuggestions.custom;
                            return (
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[11px] text-muted-foreground mr-0.5 self-center">Sugestões:</span>
                                    {suggestions.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setBusinessGoal(s)}
                                            className={cn(
                                                "text-[11px] px-2.5 py-1 rounded-full border transition-all",
                                                businessGoal === s
                                                    ? "bg-primary/10 border-primary/30 text-primary font-medium"
                                                    : "border-border hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Personality settings */}
                    <div className="space-y-4">
                        {/* Section header */}
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                                <Sparkles className="h-4 w-4 text-violet-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold">Personalidade</h4>
                                <p className="text-[11px] text-muted-foreground">Como o agente se comporta nas conversas</p>
                            </div>
                        </div>

                        {/* Sliders — 3 columns side by side */}
                        <div className="grid grid-cols-3 gap-3">
                            {/* Tone slider */}
                            <Card className="p-3 border-t-[3px] border-t-violet-500/60">
                                <div className="space-y-3">
                                    <div className="text-center">
                                        <Label className="text-[11px] text-muted-foreground">Tom de voz</Label>
                                        <p className="text-xs font-semibold text-violet-400 mt-0.5">{toneLabel}</p>
                                    </div>
                                    <Slider value={[personality.tone]} onValueChange={([v]) => setPersonality((p) => ({ ...p, tone: v }))} min={0} max={100} step={10} />
                                    <div className="flex justify-between text-[10px] text-muted-foreground/70">
                                        <span>Formal</span>
                                        <span>Descontraído</span>
                                    </div>
                                </div>
                            </Card>

                            {/* Verbosity slider */}
                            <Card className="p-3 border-t-[3px] border-t-blue-500/60">
                                <div className="space-y-3">
                                    <div className="text-center">
                                        <Label className="text-[11px] text-muted-foreground">Respostas</Label>
                                        <p className="text-xs font-semibold text-blue-400 mt-0.5">{verbosityLabel}</p>
                                    </div>
                                    <Slider value={[personality.verbosity]} onValueChange={([v]) => setPersonality((p) => ({ ...p, verbosity: v }))} min={0} max={100} step={10} />
                                    <div className="flex justify-between text-[10px] text-muted-foreground/70">
                                        <span>Curtas</span>
                                        <span>Detalhadas</span>
                                    </div>
                                </div>
                            </Card>

                            {/* Proactivity slider */}
                            <Card className="p-3 border-t-[3px] border-t-amber-500/60">
                                <div className="space-y-3">
                                    <div className="text-center">
                                        <Label className="text-[11px] text-muted-foreground">Proatividade</Label>
                                        <p className="text-xs font-semibold text-amber-400 mt-0.5">{proactivityLabel}</p>
                                    </div>
                                    <Slider value={[personality.proactivity]} onValueChange={([v]) => setPersonality((p) => ({ ...p, proactivity: v }))} min={0} max={100} step={10} />
                                    <div className="flex justify-between text-[10px] text-muted-foreground/70">
                                        <span>Reativo</span>
                                        <span>Proativo</span>
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* Selects — side by side in mini-cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Card className="p-4 space-y-2.5">
                                <Label className="text-xs font-medium flex items-center gap-1.5">
                                    <Globe className="h-4 w-4 text-blue-400" />
                                    Idioma
                                </Label>
                                <Select value={personality.language} onValueChange={(v) => setPersonality((p) => ({ ...p, language: v }))}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">🌐 Multi-idiomas (detecta)</SelectItem>
                                        <SelectItem value="pt-BR">🇧🇷 Português</SelectItem>
                                        <SelectItem value="es">🇪🇸 Espanhol</SelectItem>
                                        <SelectItem value="en">🇺🇸 Inglês</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Card>
                            <Card className="p-4 space-y-2.5">
                                <Label className="text-xs font-medium flex items-center gap-1.5">
                                    <Zap className="h-4 w-4 text-amber-400" />
                                    Velocidade de resposta
                                </Label>
                                <Select value={personality.response_speed} onValueChange={(v) => setPersonality((p) => ({ ...p, response_speed: v }))}>
                                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="instant">⚡ Instantânea</SelectItem>
                                        <SelectItem value="simulated">⌨️ Simula digitação</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Card>
                        </div>

                        {/* Switches — each in its own mini-card row */}
                        <div className="space-y-2">
                            {[
                                { key: "use_emojis" as const, icon: Smile, label: "Usar emojis", desc: "Torna a conversa mais leve e humana", color: "text-amber-400" },
                                { key: "use_slang" as const, icon: MessageCircle, label: "Gírias e regionalismos", desc: "\"Beleza\", \"top\", \"show de bola\"", color: "text-blue-400" },
                                { key: "formal_names" as const, icon: UserCheck, label: "Tratamento formal", desc: "Usar \"Sr./Sra.\" ao invés do primeiro nome", color: "text-violet-400" },
                                { key: "use_audio" as const, icon: Mic, label: "Enviar áudios", desc: "Permite responder com mensagens de voz", color: "text-emerald-400" },
                            ].map((item) => (
                                <Card
                                    key={item.key}
                                    className={cn(
                                        "p-3.5 flex items-center justify-between cursor-pointer transition-all hover:shadow-sm",
                                        (personality as any)[item.key] && "border-primary/30 bg-primary/[0.03]"
                                    )}
                                    onClick={() => setPersonality((p: any) => ({ ...p, [item.key]: !p[item.key] }))}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                            (personality as any)[item.key] ? "bg-primary/10" : "bg-muted/50"
                                        )}>
                                            <item.icon className={cn("h-4.5 w-4.5", item.color)} />
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium cursor-pointer">{item.label}</Label>
                                            <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={(personality as any)[item.key]}
                                        onCheckedChange={(v) => setPersonality((p: any) => ({ ...p, [item.key]: v }))}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </Card>
                            ))}
                        </div>
                    </div>
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
            {/* STEP 4: FERRAMENTAS                               */}
            {/* ═══════════════════════════════════════════════ */}
            {currentStep === "tools" && (
                <div className="space-y-5 animate-in fade-in duration-200">

                    {/* Tip */}
                    <Card className="p-4 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5 border-amber-500/20">
                        <div className="flex gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 shrink-0 h-fit">
                                <Wrench className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Ferramentas dão superpoderes ao agente</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Com ferramentas ativadas, o agente pode <strong>consultar dados reais</strong> do
                                    seu sistema — como agendamentos, disponibilidade e dados do cliente —
                                    em vez de inventar respostas.
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Core Tools — Always Active */}
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Lock className="h-4 w-4 text-emerald-500" />
                                Ferramentas automáticas
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Sempre ativas em todos os agentes. Não podem ser desativadas.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {coreTools.map((tool) => {
                                const ToolIcon = tool.icon;
                                return (
                                    <Card
                                        key={tool.id}
                                        className="p-3 border-emerald-500/30 bg-emerald-500/5"
                                    >
                                        <div className="flex items-start gap-2">
                                            <Check className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <ToolIcon className="h-3.5 w-3.5 text-emerald-500" />
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

                    {/* Optional Tools */}
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold flex items-center gap-2">
                                <Wrench className="h-4 w-4 text-primary" />
                                Ferramentas opcionais
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ative ou desative conforme a necessidade deste agente.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {optionalTools.map((tool) => {
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
                </div>
            )}

            {/* ═══════════════════════════════════════════════ */}
            {/* STEP 4: APLICAR                                   */}
            {/* ═══════════════════════════════════════════════ */}
            {currentStep === "apply" && (
                <div className="space-y-5 animate-in fade-in duration-200">

                    {/* Agent summary — compact hero */}
                    <Card className="p-0 overflow-hidden border-0 shadow-xl">
                        <div className="relative bg-gradient-to-br from-gray-100 via-slate-200 to-gray-100 dark:from-slate-800 dark:via-slate-700 dark:to-zinc-800 px-5 py-4">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(0,0,0,0.02),transparent_60%)] dark:bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.04),transparent_60%)]" />
                            <div className="relative flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                                    <SelectedIconComp className="h-7 w-7 text-slate-700 dark:text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-slate-800 dark:text-white font-bold text-lg truncate">{agentName || "Sem nome"}</h3>
                                        <Badge className="bg-slate-500/10 dark:bg-white/15 text-slate-600 dark:text-white text-[9px] border-0 shrink-0">SUPER AGENT</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {personaName && (
                                            <span className="text-xs text-slate-600 dark:text-white/70 bg-slate-500/10 dark:bg-white/10 px-2 py-0.5 rounded-full">{personaName}</span>
                                        )}
                                        <span className="text-xs text-slate-500 dark:text-white/50">{toneLabel}</span>
                                        <span className="text-xs text-slate-300 dark:text-white/30">•</span>
                                        <span className="text-xs text-slate-500 dark:text-white/50">{coreToolIds.length + enabledTools.filter(t => !coreToolIds.includes(t)).length} tools</span>
                                    </div>
                                    {businessGoal && (
                                        <p className="text-slate-400 dark:text-white/45 text-xs mt-2 flex items-center gap-1.5 truncate">
                                            <Target className="h-3 w-3 shrink-0" />
                                            {businessGoal}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Instance selection */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                                <Zap className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold">Vincular instância WhatsApp</h4>
                                <p className="text-[11px] text-muted-foreground">Selecione em quais números este agente vai atuar</p>
                            </div>
                        </div>

                        {instances.length === 0 ? (
                            <Card className="p-8 text-center border-dashed">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                                        <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">Nenhuma instância encontrada</p>
                                        <p className="text-xs text-muted-foreground/70 mt-1">Conecte um WhatsApp primeiro nas configurações</p>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {instances.map((inst: any) => {
                                    const isSelected = selectedInstances.includes(inst.id);
                                    const isConnected = inst.status === "connected";
                                    const hasOtherAgent = inst.super_agent_id && inst.super_agent_id !== editAgent?.id;
                                    const phone = inst.phone || "Sem número";
                                    const name = inst.display_name || inst.instance_name || "Instância";

                                    return (
                                        <Card
                                            key={inst.id}
                                            className={cn(
                                                "p-0 overflow-hidden cursor-pointer transition-all hover:shadow-md",
                                                isSelected && "ring-2 ring-primary shadow-md",
                                                hasOtherAgent && "opacity-75"
                                            )}
                                            onClick={() => {
                                                setSelectedInstances((prev) =>
                                                    prev.includes(inst.id) ? prev.filter((id) => id !== inst.id) : [...prev, inst.id]
                                                );
                                            }}
                                        >
                                            <div className="flex items-center gap-4 p-4">
                                                {/* Selection indicator */}
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all border-2",
                                                    isSelected
                                                        ? "bg-primary border-primary text-white"
                                                        : "bg-muted/30 border-border text-muted-foreground"
                                                )}>
                                                    {isSelected ? (
                                                        <Check className="h-5 w-5" />
                                                    ) : (
                                                        <MessageCircle className="h-4 w-4" />
                                                    )}
                                                </div>

                                                {/* Instance info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold truncate">{name}</p>
                                                        {/* Connection status dot */}
                                                        <div className={cn(
                                                            "w-2 h-2 rounded-full shrink-0",
                                                            isConnected ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-gray-400"
                                                        )} />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{phone}</p>
                                                    {hasOtherAgent && (
                                                        <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                                                            <Info className="h-3 w-3" />
                                                            Já vinculada a outro agente
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Status badge */}
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] shrink-0",
                                                        isConnected
                                                            ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                                            : "border-border text-muted-foreground"
                                                    )}
                                                >
                                                    {isConnected ? "Online" : "Offline"}
                                                </Badge>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selection counter */}
                        {instances.length > 0 && (
                            <p className="text-[11px] text-muted-foreground text-center">
                                {selectedInstances.length === 0
                                    ? "Nenhuma instância selecionada — o agente pode ser vinculado depois"
                                    : `${selectedInstances.length} instância${selectedInstances.length > 1 ? "s" : ""} selecionada${selectedInstances.length > 1 ? "s" : ""}`
                                }
                            </p>
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
