import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Trash2, Save, Play, Plus, X, 
  User, Sparkles, MessageSquare, Settings2,
  Star, BookOpen, Building2, Briefcase, DollarSign, 
  HelpCircle, FileText, FileQuestion, RefreshCw, Loader2, ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApplyTemplateDialog } from "./ApplyTemplateDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const knowledgeCategories = [
  { value: "company", label: "Empresa", icon: Building2, color: "bg-blue-500" },
  { value: "services", label: "Serviços", icon: Briefcase, color: "bg-green-500" },
  { value: "pricing", label: "Preços", icon: DollarSign, color: "bg-yellow-500" },
  { value: "faq", label: "FAQ", icon: HelpCircle, color: "bg-purple-500" },
  { value: "policies", label: "Políticas", icon: FileText, color: "bg-orange-500" },
  { value: "custom", label: "Personalizado", icon: FileQuestion, color: "bg-gray-500" },
];

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  is_active: boolean;
}

interface TemplateConfig {
  personality?: {
    tone: number;
    verbosity: number;
    proactivity: number;
    assistant_name: string;
    use_emojis: boolean;
    avatar_gender?: string;
  };
  system_prompt?: string;
  quick_replies?: Array<{
    id?: string;
    trigger: string;
    response: string;
    enabled: boolean;
  }>;
  behavior?: {
    business_hours: {
      enabled?: boolean;
      start: string;
      end: string;
      weekdays_only: boolean;
    };
    out_of_hours_message: string;
    human_transfer_keywords: string[];
    max_auto_responses: number;
    appointment_detection: boolean;
    appointment_keywords: string[];
    respond_in_groups: boolean;
    group_mention_only: boolean;
    group_mention_trigger: string;
    message_buffer_timeout: number;
  };
}

interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  config: TemplateConfig;
  is_favorite: boolean;
  created_at: string;
  avatar_url?: string | null;
  agent_type?: string | null;
  agent_persona_name?: string | null;
  trigger_keywords?: string[] | null;
  trigger_intents?: string[] | null;
  transition_message?: string | null;
}

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: CustomTemplate | null;
  workspaceId: string;
  onApplyToWorkspace: (config: TemplateConfig) => void;
}

const defaultConfig: TemplateConfig = {
  personality: {
    tone: 70,
    verbosity: 50,
    proactivity: 60,
    assistant_name: "Assistente",
    use_emojis: true,
  },
  system_prompt: "",
  quick_replies: [],
  behavior: {
    business_hours: { enabled: false, start: "00:00", end: "23:59", weekdays_only: false },
    out_of_hours_message: "",
    human_transfer_keywords: [],
    max_auto_responses: 10,
    appointment_detection: true,
    appointment_keywords: [],
    respond_in_groups: false,
    group_mention_only: true,
    group_mention_trigger: "@assistente",
    message_buffer_timeout: 30,
  },
};

export const TemplateEditorDialog = ({
  open,
  onOpenChange,
  template,
  workspaceId,
  onApplyToWorkspace,
}: TemplateEditorDialogProps) => {
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [isRegeneratingAvatar, setIsRegeneratingAvatar] = useState(false);
  
  // Local state for editing
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<TemplateConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Agent identity state
  const [agentPersonaName, setAgentPersonaName] = useState("");
  const [agentType, setAgentType] = useState<string>("general");
  const [avatarGender, setAvatarGender] = useState<string>("neutral");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [triggerKeywords, setTriggerKeywords] = useState<string[]>([]);
  const [triggerIntents, setTriggerIntents] = useState<string[]>([]);
  const [newTriggerKeyword, setNewTriggerKeyword] = useState("");
  const [newTriggerIntent, setNewTriggerIntent] = useState("");
  const [transitionMessage, setTransitionMessage] = useState("");
  
  // Behavior state
  const [newHumanKeyword, setNewHumanKeyword] = useState("");
  const [newAppointmentKeyword, setNewAppointmentKeyword] = useState("");

  // Knowledge base state
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [knowledgeForm, setKnowledgeForm] = useState({
    category: "services",
    title: "",
    content: "",
    keywords: "",
  });

  // Fetch knowledge base items
  const { data: knowledgeItems = [], isLoading: isLoadingKnowledge } = useQuery({
    queryKey: ["knowledge_base", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as KnowledgeItem[];
    },
    enabled: !!workspaceId && open,
  });

  // Initialize state when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setAgentPersonaName(template.agent_persona_name || "");
      setAgentType(template.agent_type || "general");
      setAvatarUrl(template.avatar_url || null);
      setTriggerKeywords(template.trigger_keywords || []);
      setTriggerIntents(template.trigger_intents || []);
      setTransitionMessage(template.transition_message || "");
      // Load avatar_gender from config if available
      setAvatarGender(template.config?.personality?.avatar_gender || "neutral");
      setConfig({
        personality: template.config.personality || defaultConfig.personality,
        system_prompt: template.config.system_prompt || "",
        quick_replies: template.config.quick_replies || [],
        behavior: {
          ...defaultConfig.behavior,
          ...template.config.behavior,
        },
      });
      setHasChanges(false);
    }
  }, [template]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No template selected");
      
      // Validate quick replies before saving
      const invalidQuickReplies = (config.quick_replies || []).filter(qr => 
        qr.enabled && (!qr.trigger?.trim() || !qr.response?.trim())
      );
      
      if (invalidQuickReplies.length > 0) {
        throw new Error("Respostas rápidas habilitadas precisam ter gatilho e resposta preenchidos");
      }
      
      // Merge avatar_gender into personality config before saving
      const configToSave = {
        ...config,
        personality: {
          ...config.personality,
          avatar_gender: avatarGender,
        },
      };
      
      const { error } = await supabase
        .from("custom_templates")
        .update({
          name,
          description: description || null,
          agent_persona_name: agentPersonaName || null,
          agent_type: agentType,
          trigger_keywords: triggerKeywords,
          trigger_intents: triggerIntents,
          transition_message: transitionMessage || null,
          config: JSON.parse(JSON.stringify(configToSave)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
      toast.success("Template atualizado!");
      setHasChanges(false);
    },
    onError: (error: Error) => {
      console.error("Error updating template:", error);
      toast.error(error.message || "Erro ao atualizar template");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No template selected");
      
      const { error } = await supabase
        .from("custom_templates")
        .delete()
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
      toast.success("Template excluído");
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template");
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("No template selected");
      
      const { error } = await supabase
        .from("custom_templates")
        .update({ is_favorite: !template.is_favorite })
        .eq("id", template.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
    },
  });

  // Generate/Regenerate avatar function
  const handleGenerateAvatar = async () => {
    if (!template) return;
    
    if (!agentPersonaName.trim()) {
      toast.error("Preencha o nome da persona primeiro");
      return;
    }
    
    setIsRegeneratingAvatar(true);
    try {
      const response = await supabase.functions.invoke('generate-avatar', {
        body: {
          personaName: agentPersonaName,
          agentType: agentType,
          agentId: template.id,
          gender: avatarGender,
        },
      });

      if (response.error) {
        console.error("Error generating avatar:", response.error);
        const errorMsg = response.error.message || "";
        if (errorMsg.includes("Rate limit")) {
          toast.error("Limite de requisições atingido. Aguarde alguns minutos.");
        } else if (errorMsg.includes("Payment")) {
          toast.error("Créditos insuficientes. Adicione créditos na sua conta.");
        } else {
          toast.error("Erro ao gerar avatar. Tente novamente.");
        }
      } else if (response.data?.avatarUrl) {
        // Ensure cache-buster is present to force browser to fetch new image
        const newAvatarUrl = response.data.avatarUrl.includes('?') 
          ? response.data.avatarUrl 
          : `${response.data.avatarUrl}?v=${Date.now()}`;
        setAvatarUrl(newAvatarUrl);
        queryClient.invalidateQueries({ queryKey: ["custom-templates", workspaceId] });
        toast.success("Avatar gerado com sucesso!");
      } else if (response.data?.error) {
        const errorMsg = response.data.error || "";
        if (errorMsg.includes("Rate limit")) {
          toast.error("Limite de requisições atingido. Aguarde alguns minutos.");
        } else if (errorMsg.includes("Payment")) {
          toast.error("Créditos insuficientes. Adicione créditos na sua conta.");
        } else {
          toast.error(`Erro: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error("Error generating avatar:", error);
      toast.error("Erro ao gerar avatar");
    } finally {
      setIsRegeneratingAvatar(false);
    }
  };

  // Knowledge base mutations
  const addKnowledgeMutation = useMutation({
    mutationFn: async (data: typeof knowledgeForm) => {
      if (!workspaceId) throw new Error("Workspace não encontrado");

      const { error } = await supabase
        .from("knowledge_base")
        .insert({
          workspace_id: workspaceId,
          category: data.category,
          title: data.title,
          content: data.content,
          keywords: data.keywords.split(",").map((k) => k.trim()).filter(Boolean),
          priority: 0,
          is_active: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_base", workspaceId] });
      toast.success("Item adicionado à base de conhecimento!");
      setShowAddKnowledge(false);
      setKnowledgeForm({ category: "services", title: "", content: "", keywords: "" });
    },
    onError: (error) => {
      console.error("Error adding knowledge:", error);
      toast.error("Erro ao adicionar item");
    },
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_base", workspaceId] });
      toast.success("Item excluído!");
    },
    onError: (error) => {
      console.error("Error deleting knowledge:", error);
      toast.error("Erro ao excluir item");
    },
  });

  const getCategoryInfo = (value: string) => {
    return knowledgeCategories.find((c) => c.value === value) || knowledgeCategories[5];
  };

  const updateConfig = <K extends keyof TemplateConfig>(
    key: K,
    value: TemplateConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updatePersonality = (updates: Partial<TemplateConfig["personality"]>) => {
    setConfig((prev) => ({
      ...prev,
      personality: { ...prev.personality!, ...updates },
    }));
    setHasChanges(true);
  };

  const updateBehavior = (updates: Partial<TemplateConfig["behavior"]>) => {
    setConfig((prev) => ({
      ...prev,
      behavior: { ...prev.behavior!, ...updates },
    }));
    setHasChanges(true);
  };

  // Quick replies helpers
  const addQuickReply = () => {
    const newReply = {
      id: crypto.randomUUID(),
      trigger: "",
      response: "",
      enabled: true,
    };
    updateConfig("quick_replies", [...(config.quick_replies || []), newReply]);
  };

  const updateQuickReply = (id: string, updates: Partial<{ trigger: string; response: string; enabled: boolean }>) => {
    updateConfig(
      "quick_replies",
      (config.quick_replies || []).map((r) =>
        (r.id || r.trigger) === id ? { ...r, ...updates } : r
      )
    );
  };

  const removeQuickReply = (id: string) => {
    updateConfig(
      "quick_replies",
      (config.quick_replies || []).filter((r) => (r.id || r.trigger) !== id)
    );
  };

  if (!template) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-[90vw] md:w-[calc(100vw-300px)] lg:w-auto md:max-w-xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-200 ease-out">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center gap-3 md:gap-4">
              {/* Avatar with generate option - responsive sizing */}
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={agentPersonaName || name}
                    className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full object-cover ring-2 ring-border"
                  />
                ) : (
                  <div className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    {agentPersonaName ? (
                      <span className="text-lg md:text-xl font-bold text-primary">
                        {agentPersonaName.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    )}
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -bottom-1 -right-1 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleGenerateAvatar}
                  disabled={isRegeneratingAvatar}
                  title={avatarUrl ? "Regenerar avatar" : "Gerar avatar"}
                >
                  {isRegeneratingAvatar ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setHasChanges(true);
                    }}
                    className="text-xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
                    placeholder="Nome do template"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavoriteMutation.mutate()}
                    className="flex-shrink-0"
                  >
                    <Star className={cn(
                      "w-5 h-5",
                      template.is_favorite && "fill-yellow-400 text-yellow-400"
                    )} />
                  </Button>
                </div>
                <Input
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasChanges(true);
                  }}
                  className="text-sm text-muted-foreground border-none shadow-none p-0 h-auto focus-visible:ring-0"
                  placeholder="Adicionar descrição..."
                />
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="personality" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-5 w-full flex-shrink-0">
              <TabsTrigger value="personality" className="gap-1 text-xs md:text-sm px-1 md:px-2 lg:px-3">
                <User className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden md:inline lg:hidden">Person.</span>
                <span className="hidden lg:inline">Personalidade</span>
              </TabsTrigger>
              <TabsTrigger value="prompt" className="gap-1 text-xs md:text-sm px-1 md:px-2 lg:px-3">
                <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden md:inline">Prompt</span>
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1 text-xs md:text-sm px-1 md:px-2 lg:px-3">
                <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden md:inline lg:hidden">Conhec.</span>
                <span className="hidden lg:inline">Conhecimento</span>
              </TabsTrigger>
              <TabsTrigger value="replies" className="gap-1 text-xs md:text-sm px-1 md:px-2 lg:px-3">
                <MessageSquare className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden md:inline lg:hidden">Respost.</span>
                <span className="hidden lg:inline">Respostas</span>
              </TabsTrigger>
              <TabsTrigger value="behavior" className="gap-1 text-xs md:text-sm px-1 md:px-2 lg:px-3">
                <Settings2 className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden md:inline lg:hidden">Comport.</span>
                <span className="hidden lg:inline">Comportamento</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 pr-2">
              {/* Personality Tab */}
              <TabsContent value="personality" className="m-0 space-y-6">
                {/* Agent Identity Section */}
                <Card className="p-4 space-y-4 border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary" />
                    <Label className="text-base font-semibold">Identidade do Agente</Label>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome da Persona *</Label>
                      <Input
                        value={agentPersonaName}
                        onChange={(e) => {
                          setAgentPersonaName(e.target.value);
                          setHasChanges(true);
                        }}
                        placeholder="Ex: Mariana, Carlos, Ana..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Nome que o agente usará ao se apresentar
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tipo de Agente</Label>
                      <Select 
                        value={agentType} 
                        onValueChange={(v) => {
                          setAgentType(v);
                          setHasChanges(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales">🛒 Vendas</SelectItem>
                          <SelectItem value="support">💬 Suporte</SelectItem>
                          <SelectItem value="scheduling">📅 Agendamento</SelectItem>
                          <SelectItem value="financial">💰 Financeiro</SelectItem>
                          <SelectItem value="technical">🔧 Técnico</SelectItem>
                          <SelectItem value="general">🎧 Geral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Gênero do Avatar</Label>
                      <Select 
                        value={avatarGender} 
                        onValueChange={(v) => {
                          setAvatarGender(v);
                          setHasChanges(true);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female">👩 Feminino</SelectItem>
                          <SelectItem value="male">👨 Masculino</SelectItem>
                          <SelectItem value="neutral">🧑 Neutro/Ambíguo</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Define o gênero do avatar gerado pela IA
                      </p>
                    </div>
                  </div>
                  
                  {/* Generate Avatar Button */}
                  <Button
                    variant="outline"
                    onClick={handleGenerateAvatar}
                    disabled={isRegeneratingAvatar || !agentPersonaName.trim()}
                    className="w-full"
                  >
                    {isRegeneratingAvatar ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando avatar...
                      </>
                    ) : avatarUrl ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerar Avatar com IA
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Gerar Avatar com IA
                      </>
                    )}
                  </Button>
                </Card>

                {/* Trigger Keywords for Routing */}
                <Card className="p-4 space-y-4 border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <Label className="text-base font-semibold">Roteamento Automático</Label>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Configure palavras-chave para acionar este agente automaticamente durante as conversas
                  </p>
                  
                  {/* Trigger Keywords */}
                  <div className="space-y-2">
                    <Label>Palavras-chave de Ativação</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newTriggerKeyword}
                        onChange={(e) => setNewTriggerKeyword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const keyword = newTriggerKeyword.trim().toLowerCase();
                            if (keyword && !triggerKeywords.includes(keyword)) {
                              setTriggerKeywords([...triggerKeywords, keyword]);
                              setNewTriggerKeyword("");
                              setHasChanges(true);
                            }
                          }
                        }}
                        placeholder="Ex: preço, comprar, orçamento..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const keyword = newTriggerKeyword.trim().toLowerCase();
                          if (keyword && !triggerKeywords.includes(keyword)) {
                            setTriggerKeywords([...triggerKeywords, keyword]);
                            setNewTriggerKeyword("");
                            setHasChanges(true);
                          }
                        }}
                        disabled={!newTriggerKeyword.trim()}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {triggerKeywords.map((keyword) => (
                        <Badge
                          key={keyword}
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => {
                              setTriggerKeywords(triggerKeywords.filter(k => k !== keyword));
                              setHasChanges(true);
                            }}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      {triggerKeywords.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          Nenhuma palavra-chave. O agente não será acionado automaticamente.
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Trigger Intents */}
                  <div className="space-y-2">
                    <Label>Intenções (para IA)</Label>
                    <p className="text-xs text-muted-foreground">
                      Descrições de intenção para quando o roteamento por IA está ativado
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={newTriggerIntent}
                        onChange={(e) => setNewTriggerIntent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const intent = newTriggerIntent.trim();
                            if (intent && !triggerIntents.includes(intent)) {
                              setTriggerIntents([...triggerIntents, intent]);
                              setNewTriggerIntent("");
                              setHasChanges(true);
                            }
                          }
                        }}
                        placeholder="Ex: cliente quer saber preços..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const intent = newTriggerIntent.trim();
                          if (intent && !triggerIntents.includes(intent)) {
                            setTriggerIntents([...triggerIntents, intent]);
                            setNewTriggerIntent("");
                            setHasChanges(true);
                          }
                        }}
                        disabled={!newTriggerIntent.trim()}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      {triggerIntents.map((intent) => (
                        <Badge
                          key={intent}
                          variant="outline"
                          className="pl-2 pr-1 py-1 flex items-center gap-1"
                        >
                          {intent}
                          <button
                            type="button"
                            onClick={() => {
                              setTriggerIntents(triggerIntents.filter(i => i !== intent));
                              setHasChanges(true);
                            }}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      {triggerIntents.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                          Sem intenções. A IA usará o tipo do agente como referência.
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Transition Message for Routing */}
                <div className="space-y-2">
                  <Label>Mensagem de Transição</Label>
                  <Textarea
                    value={transitionMessage}
                    onChange={(e) => {
                      setTransitionMessage(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Ex: Vou te transferir para um especialista..."
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mensagem enviada quando a conversa é transferida para este agente (deixe vazio para transição silenciosa)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Nome nas Mensagens</Label>
                  <Input
                    value={config.personality?.assistant_name || ""}
                    onChange={(e) => updatePersonality({ assistant_name: e.target.value })}
                    placeholder="Ex: Ana, Carlos, Assistente..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Nome exibido nas mensagens (pode ser diferente da persona)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Tom de Voz</Label>
                    <span className="text-sm text-muted-foreground">
                      {(config.personality?.tone || 50) < 40 ? "Formal" : (config.personality?.tone || 50) > 60 ? "Informal" : "Neutro"}
                    </span>
                  </div>
                  <Slider
                    value={[config.personality?.tone || 50]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) => updatePersonality({ tone: value })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Formal</span>
                    <span>Informal</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Verbosidade</Label>
                    <span className="text-sm text-muted-foreground">
                      {(config.personality?.verbosity || 50) < 40 ? "Conciso" : (config.personality?.verbosity || 50) > 60 ? "Detalhado" : "Equilibrado"}
                    </span>
                  </div>
                  <Slider
                    value={[config.personality?.verbosity || 50]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) => updatePersonality({ verbosity: value })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Conciso</span>
                    <span>Detalhado</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Proatividade</Label>
                    <span className="text-sm text-muted-foreground">
                      {(config.personality?.proactivity || 50) < 40 ? "Reativo" : (config.personality?.proactivity || 50) > 60 ? "Proativo" : "Equilibrado"}
                    </span>
                  </div>
                  <Slider
                    value={[config.personality?.proactivity || 50]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) => updatePersonality({ proactivity: value })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Reativo</span>
                    <span>Proativo</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Usar Emojis</Label>
                    <p className="text-sm text-muted-foreground">
                      Incluir emojis nas respostas
                    </p>
                  </div>
                  <Switch
                    checked={config.personality?.use_emojis ?? true}
                    onCheckedChange={(checked) => updatePersonality({ use_emojis: checked })}
                  />
                </div>
              </TabsContent>

              {/* Prompt Tab */}
              <TabsContent value="prompt" className="m-0 space-y-4">
                <div>
                  <Label>Prompt do Sistema</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Instruções detalhadas sobre como a IA deve se comportar
                  </p>
                  <Textarea
                    value={config.system_prompt || ""}
                    onChange={(e) => updateConfig("system_prompt", e.target.value)}
                    placeholder="Você é um assistente especializado em..."
                    rows={12}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    {(config.system_prompt || "").length} caracteres
                  </p>
                </div>
              </TabsContent>

              {/* Knowledge Tab */}
              <TabsContent value="knowledge" className="m-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Base de Conhecimento</Label>
                    <p className="text-sm text-muted-foreground">
                      Informações que a IA usará para responder clientes
                    </p>
                  </div>
                  <Button onClick={() => setShowAddKnowledge(!showAddKnowledge)} size="sm" variant={showAddKnowledge ? "secondary" : "default"}>
                    {showAddKnowledge ? (
                      <>
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar
                      </>
                    )}
                  </Button>
                </div>

                {/* Add Knowledge Form */}
                {showAddKnowledge && (
                  <Card className="p-4 space-y-4 border-primary/50">
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={knowledgeForm.category} onValueChange={(v) => setKnowledgeForm(prev => ({ ...prev, category: v }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {knowledgeCategories.map((cat) => {
                            const Icon = cat.icon;
                            return (
                              <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {cat.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={knowledgeForm.title}
                        onChange={(e) => setKnowledgeForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Ex: Horário de funcionamento"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Conteúdo</Label>
                      <Textarea
                        value={knowledgeForm.content}
                        onChange={(e) => setKnowledgeForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Descreva as informações..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Palavras-chave (opcional)</Label>
                      <Input
                        value={knowledgeForm.keywords}
                        onChange={(e) => setKnowledgeForm(prev => ({ ...prev, keywords: e.target.value }))}
                        placeholder="horário, funcionamento, aberto (separadas por vírgula)"
                      />
                    </div>
                    <Button 
                      onClick={() => addKnowledgeMutation.mutate(knowledgeForm)}
                      disabled={!knowledgeForm.title.trim() || !knowledgeForm.content.trim() || addKnowledgeMutation.isPending}
                      className="w-full"
                    >
                      {addKnowledgeMutation.isPending ? "Salvando..." : "Salvar Item"}
                    </Button>
                  </Card>
                )}

                {/* Knowledge Items List */}
                {isLoadingKnowledge ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : knowledgeItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum item na base de conhecimento.</p>
                    <p className="text-xs mt-1">Adicione informações sobre sua empresa, serviços e preços.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {knowledgeItems.map((item) => {
                      const catInfo = getCategoryInfo(item.category);
                      const Icon = catInfo.icon;
                      return (
                        <Card key={item.id} className={cn("p-3", !item.is_active && "opacity-50")}>
                          <div className="flex items-start gap-3">
                            <div className={cn("p-1.5 rounded-lg text-white shrink-0", catInfo.color)}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm truncate">{item.title}</h4>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {catInfo.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {item.content}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                              onClick={() => deleteKnowledgeMutation.mutate(item.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Quick Replies Tab */}
              <TabsContent value="replies" className="m-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Respostas Rápidas</Label>
                    <p className="text-sm text-muted-foreground">
                      Respostas automáticas para palavras-chave específicas
                    </p>
                  </div>
                  <Button onClick={addQuickReply} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>

                {(config.quick_replies || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma resposta rápida configurada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(config.quick_replies || []).map((reply, index) => (
                      <div
                        key={reply.id || index}
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Resposta #{index + 1}</Label>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={reply.enabled}
                              onCheckedChange={(checked) =>
                                updateQuickReply(reply.id || reply.trigger, { enabled: checked })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => removeQuickReply(reply.id || reply.trigger)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Input
                            placeholder="Palavra-chave (ex: preço, horário)"
                            value={reply.trigger}
                            onChange={(e) =>
                              updateQuickReply(reply.id || reply.trigger, { trigger: e.target.value })
                            }
                            className={cn(
                              reply.enabled && !reply.trigger?.trim() && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          {reply.enabled && !reply.trigger?.trim() && (
                            <p className="text-xs text-destructive mt-1">Obrigatório quando habilitado</p>
                          )}
                        </div>
                        <div>
                          <Textarea
                            placeholder="Resposta automática..."
                            value={reply.response}
                            onChange={(e) =>
                              updateQuickReply(reply.id || reply.trigger, { response: e.target.value })
                            }
                            rows={2}
                            className={cn(
                              reply.enabled && !reply.response?.trim() && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          {reply.enabled && !reply.response?.trim() && (
                            <p className="text-xs text-destructive mt-1">Obrigatório quando habilitado</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Behavior Tab */}
              <TabsContent value="behavior" className="m-0 space-y-6">
                {/* Toggle principal de horário de atendimento */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">Limitar horário de atendimento</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-5 w-5 text-muted-foreground cursor-help flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[250px]">
                        <p>Desative para a IA responder 24 horas por dia, 7 dias por semana</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch
                    checked={config.behavior?.business_hours?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      updateBehavior({
                        business_hours: {
                          ...config.behavior!.business_hours,
                          enabled: checked,
                        },
                      })
                    }
                    className="self-end sm:self-auto"
                  />
                </div>

                {/* Campos de horário - só aparecem se toggle ativado */}
                {config.behavior?.business_hours?.enabled && (
                  <div className="ml-2 pl-2 sm:ml-4 sm:pl-4 border-l-2 border-border space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-sm">Início</Label>
                        <Input
                          type="time"
                          value={config.behavior?.business_hours.start || "08:00"}
                          onChange={(e) =>
                            updateBehavior({
                              business_hours: {
                                ...config.behavior!.business_hours,
                                start: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Término</Label>
                        <Input
                          type="time"
                          value={config.behavior?.business_hours.end || "18:00"}
                          onChange={(e) =>
                            updateBehavior({
                              business_hours: {
                                ...config.behavior!.business_hours,
                                end: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Apenas dias de semana</Label>
                      <Switch
                        checked={config.behavior?.business_hours.weekdays_only ?? false}
                        onCheckedChange={(checked) =>
                          updateBehavior({
                            business_hours: {
                              ...config.behavior!.business_hours,
                              weekdays_only: checked,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mensagem Fora do Horário</Label>
                      <Textarea
                        value={config.behavior?.out_of_hours_message || ""}
                        onChange={(e) => updateBehavior({ out_of_hours_message: e.target.value })}
                        placeholder="Mensagem enviada fora do horário de atendimento..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Palavras-chave para Transferência Humana</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newHumanKeyword}
                      onChange={(e) => setNewHumanKeyword(e.target.value)}
                      placeholder="Digite uma palavra-chave"
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newHumanKeyword.trim()) {
                          updateBehavior({
                            human_transfer_keywords: [
                              ...(config.behavior?.human_transfer_keywords || []),
                              newHumanKeyword.trim(),
                            ],
                          });
                          setNewHumanKeyword("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newHumanKeyword.trim()) {
                          updateBehavior({
                            human_transfer_keywords: [
                              ...(config.behavior?.human_transfer_keywords || []),
                              newHumanKeyword.trim(),
                            ],
                          });
                          setNewHumanKeyword("");
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(config.behavior?.human_transfer_keywords || []).map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="gap-1">
                        {keyword}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() =>
                            updateBehavior({
                              human_transfer_keywords: (config.behavior?.human_transfer_keywords || []).filter(
                                (k) => k !== keyword
                              ),
                            })
                          }
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Limite de Respostas Automáticas</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={config.behavior?.max_auto_responses || 10}
                    onChange={(e) =>
                      updateBehavior({ max_auto_responses: parseInt(e.target.value) || 10 })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Responder em Grupos</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar respostas automáticas em grupos
                    </p>
                  </div>
                  <Switch
                    checked={config.behavior?.respond_in_groups ?? false}
                    onCheckedChange={(checked) => updateBehavior({ respond_in_groups: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Timeout do Buffer de Mensagens</Label>
                  <Input
                    type="number"
                    min="5"
                    max="120"
                    value={config.behavior?.message_buffer_timeout || 30}
                    onChange={(e) =>
                      updateBehavior({ message_buffer_timeout: parseInt(e.target.value) || 30 })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo em segundos para aguardar mensagens fragmentadas (5-120s)
                  </p>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="flex-shrink-0 mt-4 flex-col md:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="sm:mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowApplyDialog(true)}
            >
              <Play className="w-4 h-4 mr-2" />
              Aplicar em...
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!hasChanges || updateMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{template?.name}" será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Apply Template Dialog */}
      <ApplyTemplateDialog
        open={showApplyDialog}
        onOpenChange={setShowApplyDialog}
        template={template}
        workspaceId={workspaceId}
        onApplyToWorkspace={onApplyToWorkspace}
      />
    </>
  );
};
