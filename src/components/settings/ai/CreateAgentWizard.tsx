import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User, Bot, Heart, Star, Zap, Coffee,
  MessageCircle, Sparkles, Shield, Target,
  Award, Crown, Lightbulb, Rocket, Loader2,
  Check, ChevronRight, ChevronLeft,
  Briefcase, Wrench, Plus, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AgentTypeSelector } from "./AgentTypeSelector";
import { AgentIdentityStep } from "./AgentIdentityStep";
import { AGENT_PROFILES, AgentType } from "@/lib/agent-profiles";

const iconOptions = [
  { id: "user", icon: User },
  { id: "bot", icon: Bot },
  { id: "heart", icon: Heart },
  { id: "star", icon: Star },
  { id: "zap", icon: Zap },
  { id: "coffee", icon: Coffee },
  { id: "message-circle", icon: MessageCircle },
  { id: "sparkles", icon: Sparkles },
  { id: "shield", icon: Shield },
  { id: "target", icon: Target },
  { id: "award", icon: Award },
  { id: "crown", icon: Crown },
  { id: "lightbulb", icon: Lightbulb },
  { id: "rocket", icon: Rocket },
  { id: "shopping-cart", icon: Target },
  { id: "calendar", icon: Target },
  { id: "dollar-sign", icon: Target },
  { id: "wrench", icon: Wrench },
  { id: "headphones", icon: Target },
];

const knowledgeCategories = [
  { id: "empresa", label: "Empresa", icon: Briefcase },
  { id: "servicos", label: "Serviços", icon: Wrench },
  { id: "precos", label: "Preços", icon: Target },
  { id: "faq", label: "FAQ", icon: MessageCircle },
  { id: "outro", label: "Outro", icon: Star },
];

interface CreateAgentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onComplete?: () => void;
}

type WizardStep = "type" | "identity" | "personality" | "knowledge" | "apply";

interface KnowledgeItem {
  id?: string;
  category: string;
  title: string;
  content: string;
  keywords: string;
  isNew?: boolean;
}

export const CreateAgentWizard = ({
  open,
  onOpenChange,
  workspaceId,
  onComplete
}: CreateAgentWizardProps) => {
  const queryClient = useQueryClient();
  const { subscription } = useSubscription();
  const isSingleInstancePlan = subscription?.plan_type === 'trial' || subscription?.plan_type === 'start';
  const [currentStep, setCurrentStep] = useState<WizardStep>("type");

  // Agent type state
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType | 'custom' | null>(null);

  // Identity state
  const [agentName, setAgentName] = useState("");
  const [agentDescription, setAgentDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("star");

  // Persona state
  const [personaName, setPersonaName] = useState("");
  const [transitionMessage, setTransitionMessage] = useState("");
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);

  // Personality state
  const [personality, setPersonality] = useState({
    tone: 50,
    verbosity: 50,
    proactivity: 50,
    use_emojis: true,
  });
  const [systemPrompt, setSystemPrompt] = useState("");

  // Knowledge state
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState<KnowledgeItem>({
    category: "empresa",
    title: "",
    content: "",
    keywords: "",
    isNew: true,
  });

  // Apply state
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [applyGlobal, setApplyGlobal] = useState(false);

  // Fetch WhatsApp instances
  const { data: instances = [] } = useQuery({
    queryKey: ["whatsapp-instances", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, phone, display_name, status, ai_template_id")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && open,
  });

  // Apply agent type profile when selected
  const handleAgentTypeSelect = (type: AgentType | 'custom') => {
    setSelectedAgentType(type);

    if (type !== 'custom') {
      const profile = AGENT_PROFILES[type];
      setAgentName(profile.name);
      setSelectedIcon(profile.iconId);
      setPersonality(profile.personality);
      setSystemPrompt(profile.system_prompt);
      setTriggerKeywords(profile.trigger_keywords);
      if (profile.suggested_personas.length > 0) {
        const randomPersona = profile.suggested_personas[Math.floor(Math.random() * profile.suggested_personas.length)];
        setPersonaName(randomPersona);
        setTransitionMessage(profile.default_transition.replace('{persona}', randomPersona));
      }
    } else {
      setAgentName("");
      setPersonality({ tone: 50, verbosity: 50, proactivity: 50, use_emojis: true });
      setSystemPrompt("Você é um assistente virtual prestativo. Ajude o cliente com suas dúvidas de forma clara e eficiente.");
      setTriggerKeywords([]);
      setPersonaName("");
      setTransitionMessage("");
    }
  };

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async () => {
      const config = {
        personality: {
          ...personality,
          assistant_name: personaName || agentName,
        },
        system_prompt: systemPrompt.replace(/{persona}/g, personaName || agentName),
        behavior: {
          business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false }
        },
      };

      const { data: template, error: templateError } = await supabase
        .from("custom_templates")
        .insert({
          workspace_id: workspaceId,
          name: agentName,
          description: agentDescription || null,
          icon: selectedIcon,
          config,
          agent_type: selectedAgentType === 'custom' ? 'general' : selectedAgentType,
          agent_persona_name: personaName || null,
          trigger_keywords: triggerKeywords,
          trigger_intents: selectedAgentType && selectedAgentType !== 'custom'
            ? AGENT_PROFILES[selectedAgentType].trigger_intents
            : [],
          transition_message: transitionMessage || null,
          priority: 0,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Add knowledge items if any
      if (knowledgeItems.length > 0) {
        const knowledgeToInsert = knowledgeItems.map(item => ({
          workspace_id: workspaceId,
          category: item.category,
          title: item.title,
          content: item.content,
          keywords: item.keywords.split(",").map(k => k.trim()).filter(Boolean),
        }));

        await supabase.from("knowledge_base").insert(knowledgeToInsert);
      }

      // Apply to selected instances
      if (selectedInstances.length > 0) {
        await supabase
          .from("whatsapp_instances")
          .update({ ai_template_id: template.id })
          .in("id", selectedInstances);
      }

      // Apply globally if selected OR if single-instance plan
      if (applyGlobal || isSingleInstancePlan) {
        await supabase
          .from("system_config")
          .upsert({
            workspace_id: workspaceId,
            config_key: "ai_settings",
            config_value: {
              template: template.id,
              personality: config.personality,
              system_prompt: config.system_prompt,
              behavior: config.behavior,
            },
          }, { onConflict: "workspace_id,config_key" });
      }

      return template;
    },
    onSuccess: (template) => {
      toast.success("Agente criado com sucesso!");

      // Generate avatar in background (fire-and-forget) — don't block the UI
      if (personaName) {
        supabase.functions.invoke('generate-avatar', {
          body: {
            personaName,
            agentType: selectedAgentType === 'custom' ? 'general' : selectedAgentType,
            agentId: template.id,
          },
        }).then((response) => {
          if (response.error) {
            console.error("Error generating avatar:", response.error);
          } else {
            // Refresh agent list to show new avatar
            queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
          }
        }).catch((error) => {
          console.error("Error generating avatar:", error);
        });
      }

      queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["ai_settings", workspaceId] });
      resetWizard();
      onOpenChange(false);
      onComplete?.();
    },
    onError: (error) => {
      console.error("Error creating agent:", error);
      toast.error("Erro ao criar agente");
    },
  });

  const resetWizard = () => {
    setCurrentStep("type");
    setSelectedAgentType(null);
    setAgentName("");
    setAgentDescription("");
    setSelectedIcon("star");
    setPersonaName("");
    setTransitionMessage("");
    setTriggerKeywords([]);
    setPersonality({ tone: 50, verbosity: 50, proactivity: 50, use_emojis: true });
    setSystemPrompt("");
    setKnowledgeItems([]);
    setSelectedInstances([]);
    setApplyGlobal(false);
  };

  const steps: { id: WizardStep; label: string; number: number }[] = [
    { id: "type", label: "Tipo", number: 1 },
    { id: "identity", label: "Identidade", number: 2 },
    { id: "personality", label: "Personalidade", number: 3 },
    { id: "knowledge", label: "Conhecimento", number: 4 },
    { id: "apply", label: "Aplicar", number: 5 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case "type":
        return selectedAgentType !== null;
      case "identity":
        return agentName.trim().length > 0;
      case "personality":
        return systemPrompt.trim().length > 0;
      case "knowledge":
        return true;
      case "apply":
        return true; // Always allow creating — instances/global are optional
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleAddKnowledge = () => {
    if (newKnowledge.title && newKnowledge.content) {
      setKnowledgeItems([...knowledgeItems, { ...newKnowledge, id: `temp-${Date.now()}` }]);
      setNewKnowledge({ category: "empresa", title: "", content: "", keywords: "", isNew: true });
      setShowAddKnowledge(false);
    }
  };

  const handleRemoveKnowledge = (index: number) => {
    setKnowledgeItems(knowledgeItems.filter((_, i) => i !== index));
  };

  const toggleInstanceSelection = (instanceId: string) => {
    setSelectedInstances(prev =>
      prev.includes(instanceId)
        ? prev.filter(id => id !== instanceId)
        : [...prev, instanceId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetWizard();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-2xl h-[90dvh] overflow-hidden flex flex-col transition-all duration-200 ease-out">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-xl">Criar Novo Agente</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="shrink-0 flex items-center justify-center gap-2 py-4 border-b overflow-x-auto">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  currentStepIndex > index
                    ? "bg-primary text-primary-foreground"
                    : currentStepIndex === index
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {currentStepIndex > index ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span className={cn(
                "ml-2 text-sm hidden sm:inline",
                currentStepIndex === index ? "font-medium" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 min-h-0 px-1">
          <div className="py-4 space-y-6">
            {/* Step 1: Agent Type Selection */}
            {currentStep === "type" && (
              <AgentTypeSelector
                selectedType={selectedAgentType}
                onSelect={handleAgentTypeSelect}
              />
            )}

            {/* Step 2: Identity */}
            {currentStep === "identity" && (
              <div className="space-y-6">
                <AgentIdentityStep
                  agentType={selectedAgentType || 'general'}
                  personaName={personaName}
                  onPersonaNameChange={setPersonaName}
                  transitionMessage={transitionMessage}
                  onTransitionMessageChange={setTransitionMessage}
                  triggerKeywords={triggerKeywords}
                  onTriggerKeywordsChange={setTriggerKeywords}
                />

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Nome do Agente *</Label>
                    <Input
                      id="agent-name"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Ex: Vendedor, Atendente, Suporte"
                    />
                    <p className="text-xs text-muted-foreground">Nome interno para identificar o agente</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agent-description">Descrição (opcional)</Label>
                    <Input
                      id="agent-description"
                      value={agentDescription}
                      onChange={(e) => setAgentDescription(e.target.value)}
                      placeholder="Ex: Agente para atendimento de vendas"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <div className="flex flex-wrap gap-2">
                      {iconOptions.slice(0, 14).map(({ id, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedIcon(id)}
                          className={cn(
                            "p-3 rounded-lg border transition-all",
                            selectedIcon === id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Personality */}
            {currentStep === "personality" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Tom de Voz</Label>
                    <span className="text-sm text-muted-foreground">
                      {personality.tone < 30 ? "Formal" : personality.tone < 70 ? "Equilibrado" : "Informal"}
                    </span>
                  </div>
                  <Slider
                    value={[personality.tone]}
                    onValueChange={([value]) => setPersonality({ ...personality, tone: value })}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Formal</span>
                    <span>Informal</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Comprimento das Respostas</Label>
                    <span className="text-sm text-muted-foreground">
                      {personality.verbosity < 40 ? "Conciso" : personality.verbosity <= 60 ? "Equilibrado" : "Detalhado"}
                    </span>
                  </div>
                  <Slider
                    value={[personality.verbosity]}
                    onValueChange={([value]) => setPersonality({ ...personality, verbosity: value })}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Conciso</span>
                    <span>Detalhado</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Proatividade</Label>
                    <span className="text-sm text-muted-foreground">
                      {personality.proactivity < 30 ? "Reativo" : personality.proactivity < 70 ? "Equilibrado" : "Proativo"}
                    </span>
                  </div>
                  <Slider
                    value={[personality.proactivity]}
                    onValueChange={([value]) => setPersonality({ ...personality, proactivity: value })}
                    min={0}
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Apenas responde</span>
                    <span>Sugere próximos passos</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Usar Emojis</Label>
                    <p className="text-sm text-muted-foreground">
                      Adiciona emojis nas respostas
                    </p>
                  </div>
                  <Switch
                    checked={personality.use_emojis}
                    onCheckedChange={(checked) => setPersonality({ ...personality, use_emojis: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system-prompt">Prompt do Sistema *</Label>
                  <Textarea
                    id="system-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Descreva como o agente deve se comportar..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto define as instruções base do agente. Use {'{persona}'} para inserir o nome da persona.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Knowledge */}
            {currentStep === "knowledge" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Base de Conhecimento</h4>
                    <p className="text-sm text-muted-foreground">
                      Adicione informações que o agente pode usar (opcional)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddKnowledge(!showAddKnowledge)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {showAddKnowledge && (
                  <Card className="p-4 space-y-3 border-dashed">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Categoria</Label>
                        <Select
                          value={newKnowledge.category}
                          onValueChange={(v) => setNewKnowledge({ ...newKnowledge, category: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {knowledgeCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Título</Label>
                        <Input
                          value={newKnowledge.title}
                          onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                          placeholder="Ex: Horário de funcionamento"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Conteúdo</Label>
                      <Textarea
                        value={newKnowledge.content}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                        placeholder="Informações que o agente deve saber..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Palavras-chave (separadas por vírgula)</Label>
                      <Input
                        value={newKnowledge.keywords}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, keywords: e.target.value })}
                        placeholder="horário, funcionamento, aberto"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddKnowledge(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleAddKnowledge} disabled={!newKnowledge.title || !newKnowledge.content}>
                        Adicionar
                      </Button>
                    </div>
                  </Card>
                )}

                {knowledgeItems.length > 0 ? (
                  <div className="space-y-2">
                    {knowledgeItems.map((item, index) => {
                      const category = knowledgeCategories.find(c => c.id === item.category);
                      const CategoryIcon = category?.icon || Star;
                      return (
                        <Card key={item.id || index} className="p-3 flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <CategoryIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => handleRemoveKnowledge(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="p-6 text-center border-dashed">
                    <p className="text-sm text-muted-foreground">
                      Nenhum item adicionado. Você pode pular esta etapa e adicionar conhecimentos depois.
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* Step 5: Apply */}
            {currentStep === "apply" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Onde aplicar este agente?</h4>
                    <p className="text-sm text-muted-foreground">
                      {isSingleInstancePlan
                        ? `O agente "${agentName}" será aplicado automaticamente`
                        : `Escolha onde o agente "${agentName}" será usado`
                      }
                    </p>
                  </div>

                  {isSingleInstancePlan ? (
                    <Card className="p-4 border-primary bg-primary/5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Aplicado automaticamente</p>
                          <p className="text-sm text-muted-foreground">
                            O agente será usado em sua conexão WhatsApp
                          </p>
                        </div>
                      </div>
                    </Card>
                  ) : (
                    <>
                      <Card
                        className={cn(
                          "p-4 cursor-pointer transition-all",
                          applyGlobal
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:border-primary/50"
                        )}
                        onClick={() => {
                          setApplyGlobal(!applyGlobal);
                          if (!applyGlobal) setSelectedInstances([]);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={applyGlobal} />
                          <div>
                            <p className="font-medium">Aplicar como padrão do workspace</p>
                            <p className="text-sm text-muted-foreground">
                              Todas as novas conversas usarão este agente
                            </p>
                          </div>
                        </div>
                      </Card>

                      {instances.length > 0 && (
                        <div className="space-y-2">
                          <Label>Ou aplicar em conexões específicas:</Label>
                          {instances.map((instance) => (
                            <Card
                              key={instance.id}
                              className={cn(
                                "p-4 cursor-pointer transition-all",
                                selectedInstances.includes(instance.id)
                                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                                  : "hover:border-primary/50",
                                applyGlobal && "opacity-50 pointer-events-none"
                              )}
                              onClick={() => {
                                if (!applyGlobal) {
                                  toggleInstanceSelection(instance.id);
                                }
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={selectedInstances.includes(instance.id)}
                                  disabled={applyGlobal}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">
                                      {instance.display_name || instance.phone || "Conexão sem nome"}
                                    </p>
                                    <span className={cn(
                                      "text-xs px-2 py-0.5 rounded-full",
                                      instance.status === "connected"
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    )}>
                                      {instance.status === "connected" ? "Conectado" : "Desconectado"}
                                    </span>
                                  </div>
                                  {instance.phone && (
                                    <p className="text-sm text-muted-foreground">{instance.phone}</p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}

                      {instances.length === 0 && (
                        <Card className="p-4 border-dashed">
                          <p className="text-sm text-muted-foreground text-center">
                            Nenhuma conexão WhatsApp encontrada. O agente será salvo e você poderá aplicá-lo depois.
                          </p>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>

          {currentStep === "apply" ? (
            <Button
              onClick={() => createAgentMutation.mutate()}
              disabled={!canProceed() || createAgentMutation.isPending}
            >
              {createAgentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Criar Agente
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
