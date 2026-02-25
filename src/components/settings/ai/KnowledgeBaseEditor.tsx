import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Building2, Briefcase, DollarSign, HelpCircle, FileText, FileQuestion, Upload, Info, Globe, Bot, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { FileUploadDialog } from "./FileUploadDialog";
import { useAuditLog } from "@/hooks/useAuditLog";

interface KnowledgeItem {
  id: string;
  workspace_id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  priority: number;
  is_active: boolean;
  is_global: boolean;
  agent_ids: string[];
  embedding_status: string | null;
  created_at: string;
  updated_at: string;
}

interface Agent {
  id: string;
  name: string;
  icon: string;
}

const categories = [
  { value: "company", label: "Empresa", icon: Building2, color: "bg-blue-500" },
  { value: "services", label: "Serviços", icon: Briefcase, color: "bg-green-500" },
  { value: "pricing", label: "Preços", icon: DollarSign, color: "bg-yellow-500" },
  { value: "faq", label: "FAQ", icon: HelpCircle, color: "bg-purple-500" },
  { value: "policies", label: "Políticas", icon: FileText, color: "bg-orange-500" },
  { value: "custom", label: "Personalizado", icon: FileQuestion, color: "bg-gray-500" },
];

const categoryTemplates: Record<string, { title: string; content: string }> = {
  company: {
    title: "Sobre a Empresa",
    content: "Nome: [Nome da empresa]\nDescrição: [O que fazemos]\nDiferenciais: [O que nos torna únicos]\nLocalização: [Endereço/Região]",
  },
  services: {
    title: "Nome do Serviço",
    content: "Descrição: [O que está incluso]\nPúblico-alvo: [Para quem é indicado]\nDiferencial: [O que torna único]\nTempo de entrega: [Prazo]",
  },
  pricing: {
    title: "Pacote/Serviço",
    content: "Valor: R$ [valor]\nCondições: [parcelamento, desconto à vista]\nPrazo de entrega: [tempo]\nO que inclui: [lista de itens]",
  },
  faq: {
    title: "Pergunta frequente?",
    content: "Resposta completa para a pergunta.",
  },
  policies: {
    title: "Política de...",
    content: "Detalhes da política, condições, regras e exceções.",
  },
  custom: {
    title: "Título",
    content: "Conteúdo personalizado...",
  },
};

// Hook para polling do status de embedding
const useEmbeddingPolling = (itemId: string | null, onComplete: () => void) => {
  const [status, setStatus] = useState<'idle' | 'polling' | 'completed' | 'failed'>('idle');
  const pollCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = () => {
    if (!itemId) return;
    
    setStatus('polling');
    pollCountRef.current = 0;
    
    intervalRef.current = setInterval(async () => {
      pollCountRef.current++;
      
      try {
        const { data, error } = await supabase
          .from('knowledge_base')
          .select('embedding_status')
          .eq('id', itemId)
          .single();
        
        if (error) {
          console.error('[KB Polling] Error:', error);
          return;
        }
        
        if (data?.embedding_status === 'completed') {
          setStatus('completed');
          clearInterval(intervalRef.current!);
          onComplete();
        } else if (data?.embedding_status === 'failed') {
          setStatus('failed');
          clearInterval(intervalRef.current!);
          onComplete();
        } else if (pollCountRef.current >= 30) {
          // Timeout após 30 tentativas (30 segundos) - aguarda processamento em background
          setStatus('idle');
          clearInterval(intervalRef.current!);
          toast.info("Processamento em andamento. O item será atualizado automaticamente.");
          onComplete();
        }
      } catch (err) {
        console.error('[KB Polling] Exception:', err);
      }
    }, 1000);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { status, startPolling, stopPolling };
};

// Componente de badge de status de embedding
const EmbeddingStatusBadge = ({ status }: { status: string | null }) => {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30 gap-1">
          <CheckCircle className="h-3 w-3" />
          Pronto
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Indexando
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 gap-1">
          <Clock className="h-3 w-3" />
          Aguardando
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30 gap-1">
          <AlertCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <Clock className="h-3 w-3" />
          Pendente
        </Badge>
      );
  }
};

interface KnowledgeBaseEditorProps {
  workspaceId: string;
}

export const KnowledgeBaseEditor = ({ workspaceId }: KnowledgeBaseEditorProps) => {
  const queryClient = useQueryClient();
  const { logChange } = useAuditLog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false);
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [isWaitingEmbedding, setIsWaitingEmbedding] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category: "services",
    title: "",
    content: "",
    keywords: "",
    priority: 0,
    is_active: true,
    is_global: true,
    agent_ids: [] as string[],
  });

  // Polling hook
  const { status: pollingStatus, startPolling, stopPolling } = useEmbeddingPolling(
    savedItemId,
    () => {
      setIsWaitingEmbedding(false);
      queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
      
      if (pollingStatus === 'completed') {
        toast.success("✓ Item indexado para IA!");
      } else if (pollingStatus === 'failed') {
        toast.warning("Item salvo, mas a indexação falhou. Será reprocessado em breve.");
      } else {
        toast.info("Item salvo. A indexação está em andamento (aguarde até 30s).");
      }
      
      setIsDialogOpen(false);
      setSavedItemId(null);
    }
  );

  // Fetch agents (custom_templates)
  const { data: agents } = useQuery({
    queryKey: ["agents_for_kb", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("custom_templates")
        .select("id, name, icon")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!workspaceId,
  });

  // Fetch knowledge base items (incluindo embedding_status)
  const { data: items, isLoading } = useQuery({
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
    enabled: !!workspaceId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!workspaceId) throw new Error("Workspace não encontrado");

      const payload = {
        workspace_id: workspaceId,
        category: data.category,
        title: data.title,
        content: data.content,
        keywords: data.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        priority: data.priority,
        is_active: data.is_active,
        is_global: data.is_global,
        agent_ids: data.is_global ? [] : data.agent_ids,
        // Sempre marcar como pending para disparar o trigger
        embedding_status: 'pending',
      };

      let resultItemId: string;

      if (data.id) {
        const { error } = await supabase
          .from("knowledge_base")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
        resultItemId = data.id;
      } else {
        const { data: insertedItem, error } = await supabase
          .from("knowledge_base")
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        resultItemId = insertedItem.id;
      }

      return resultItemId;
    },
    onSuccess: (itemId) => {
      // Iniciar polling para verificar status do embedding
      setSavedItemId(itemId);
      setIsWaitingEmbedding(true);
      toast.info("Indexando para IA...", { duration: 2000 });
      
      logChange({
        action: editingItem ? 'update' : 'create',
        entity_type: 'knowledge_base',
        entity_id: editingItem?.id,
        changes_summary: editingItem 
          ? `Atualizado: ${formData.title}` 
          : `Criado: ${formData.title} (${formData.category})`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
      resetForm();
      
      // Iniciar polling
      setTimeout(() => startPolling(), 500);
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { title };
    },
    onSuccess: (data) => {
      toast.success("Item excluído!");
      logChange({
        action: 'delete',
        entity_type: 'knowledge_base',
        changes_summary: `Excluído: ${data.title}`,
      });
      queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("knowledge_base")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
    },
  });

  // Reprocessar embedding manualmente
  const reprocessEmbeddingMutation = useMutation({
    mutationFn: async (itemId: string) => {
      // Marcar como pending
      await supabase
        .from("knowledge_base")
        .update({ embedding_status: 'pending' })
        .eq("id", itemId);
      
      // Chamar edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          action: 'generate_for_item',
          knowledge_item_id: itemId
        })
      });
      
      if (!response.ok) {
        throw new Error('Falha ao reprocessar');
      }
      
      return itemId;
    },
    onSuccess: () => {
      toast.success("Reprocessando embedding...");
      queryClient.invalidateQueries({ queryKey: ["knowledge_base"] });
    },
    onError: () => {
      toast.error("Erro ao reprocessar embedding");
    }
  });

  const resetForm = () => {
    setFormData({
      category: "services",
      title: "",
      content: "",
      keywords: "",
      priority: 0,
      is_active: true,
      is_global: true,
      agent_ids: [],
    });
    setEditingItem(null);
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      title: item.title,
      content: item.content,
      keywords: item.keywords?.join(", ") || "",
      priority: item.priority,
      is_active: item.is_active,
      is_global: item.is_global ?? true,
      agent_ids: item.agent_ids || [],
    });
    setIsDialogOpen(true);
  };

  const handleCategoryChange = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      category,
      ...(editingItem ? {} : categoryTemplates[category]),
    }));
  };

  const handleAgentToggle = (agentId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      agent_ids: checked 
        ? [...prev.agent_ids, agentId]
        : prev.agent_ids.filter(id => id !== agentId),
    }));
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    if (!formData.is_global && formData.agent_ids.length === 0) {
      toast.error("Selecione pelo menos um agente");
      return;
    }
    saveMutation.mutate({ ...formData, id: editingItem?.id });
  };

  // Cleanup on dialog close
  const handleDialogClose = (open: boolean) => {
    if (!open && !isWaitingEmbedding) {
      setIsDialogOpen(false);
      resetForm();
      stopPolling();
    }
  };

  // Filter items
  const filteredItems = items?.filter((item) => {
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryInfo = (categoryValue: string) => {
    return categories.find((c) => c.value === categoryValue) || categories[5];
  };

  const getAgentNames = (agentIds: string[]) => {
    if (!agents || !agentIds?.length) return [];
    return agents
      .filter(a => agentIds.includes(a.id))
      .map(a => a.name);
  };

  // Contadores de status
  const statusCounts = items?.reduce((acc, item) => {
    const status = item.embedding_status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (isLoading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Base de Conhecimento</h3>
        <p className="text-sm text-muted-foreground">
          Configure as informações que a IA deve conhecer sobre seu negócio. 
          Essas informações serão usadas para responder clientes com dados reais.
        </p>
      </div>

      {/* Info Banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Por padrão, itens de conhecimento são <strong>compartilhados entre todos os agentes</strong>. 
          Você pode restringir a agentes específicos ao criar ou editar um item.
        </AlertDescription>
      </Alert>

      {/* Actions Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsFileUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Arquivo
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[calc(100%-2rem)] sm:w-[calc(100%-4rem)] max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-200 ease-out">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Editar Item" : "Novo Item"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => {
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
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Pacote E-commerce Completo"
                />
              </div>

              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Descreva todas as informações que a IA deve saber..."
                  rows={8}
                />
                <p className="text-xs text-muted-foreground">
                  Seja detalhado! Inclua valores, condições, prazos, etc.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Palavras-chave (opcional)</Label>
                <Input
                  value={formData.keywords}
                  onChange={(e) => setFormData((prev) => ({ ...prev, keywords: e.target.value }))}
                  placeholder="ecommerce, loja virtual, site (separadas por vírgula)"
                />
              </div>

              {/* Agent Selection */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label className="text-base font-medium">Disponível para</Label>
                
                <div className="flex items-center gap-3">
                  <div 
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${formData.is_global ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                    onClick={() => setFormData(prev => ({ ...prev, is_global: true, agent_ids: [] }))}
                  >
                    <Globe className="h-4 w-4" />
                    <span className="text-sm font-medium">Todos os agentes</span>
                  </div>
                  
                  <div 
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${!formData.is_global ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                    onClick={() => setFormData(prev => ({ ...prev, is_global: false }))}
                  >
                    <Bot className="h-4 w-4" />
                    <span className="text-sm font-medium">Agentes específicos</span>
                  </div>
                </div>

                {!formData.is_global && (
                  <div className="space-y-2 pt-2">
                    {agents && agents.length > 0 ? (
                      <div className="grid gap-2">
                        {agents.map((agent) => (
                          <div key={agent.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`agent-${agent.id}`}
                              checked={formData.agent_ids.includes(agent.id)}
                              onCheckedChange={(checked) => handleAgentToggle(agent.id, !!checked)}
                            />
                            <label 
                              htmlFor={`agent-${agent.id}`}
                              className="text-sm cursor-pointer flex items-center gap-2"
                            >
                              <Bot className="h-3 w-3 text-muted-foreground" />
                              {agent.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum agente criado. Crie agentes na aba "Agentes" primeiro.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                    min={0}
                    max={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maior = aparece primeiro
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
                    />
                    <span className="text-sm">
                      {formData.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => handleDialogClose(false)}
                  disabled={isWaitingEmbedding}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={saveMutation.isPending || isWaitingEmbedding}
                >
                  {isWaitingEmbedding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Indexando...
                    </>
                  ) : saveMutation.isPending ? (
                    "Salvando..."
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>

        {workspaceId && (
          <FileUploadDialog
            open={isFileUploadOpen}
            onOpenChange={setIsFileUploadOpen}
            workspaceId={workspaceId}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["knowledge_base"] })}
          />
        )}
      </div>

      {/* Items List */}
      {filteredItems?.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Nenhum item na base de conhecimento.
          </p>
          <p className="text-sm text-muted-foreground">
            Adicione informações sobre sua empresa, serviços e preços para que a IA responda com dados reais.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredItems?.map((item) => {
            const categoryInfo = getCategoryInfo(item.category);
            const Icon = categoryInfo.icon;
            const isGlobal = item.is_global ?? true;
            const agentNames = getAgentNames(item.agent_ids || []);

            return (
              <Card key={item.id} className={`p-4 ${!item.is_active ? "opacity-60" : ""}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0 overflow-hidden">
                    <div className={`p-2 rounded-lg ${categoryInfo.color} text-white shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <h4 className="font-medium truncate w-full text-sm sm:text-base mb-1">{item.title}</h4>
                      <div className="flex gap-1 flex-wrap mb-1">
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {categoryInfo.label}
                        </Badge>
                        {isGlobal ? (
                          <Badge variant="outline" className="shrink-0 text-xs gap-1">
                            <Globe className="h-3 w-3" />
                            Global
                          </Badge>
                        ) : agentNames.length > 0 && (
                          <Badge variant="outline" className="shrink-0 text-xs gap-1">
                            <Bot className="h-3 w-3" />
                            {agentNames.length <= 2 
                              ? agentNames.join(", ") 
                              : `${agentNames.slice(0, 2).join(", ")} +${agentNames.length - 2}`}
                          </Badge>
                        )}
                        {!item.is_active && (
                          <Badge variant="outline" className="shrink-0 text-xs">Inativo</Badge>
                        )}
                        {/* Badge de status de embedding */}
                        <EmbeddingStatusBadge status={item.embedding_status} />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
                        {item.content}
                      </p>
                      {item.keywords?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {item.keywords.map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Botão de reprocessar se falhou */}
                    {item.embedding_status === 'failed' && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => reprocessEmbeddingMutation.mutate(item.id)}
                        disabled={reprocessEmbeddingMutation.isPending}
                        title="Reprocessar embedding"
                      >
                        <RefreshCw className={`h-4 w-4 ${reprocessEmbeddingMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ id: item.id, is_active: checked })
                      }
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir item?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O item "{item.title}" será permanentemente excluído.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: item.id, title: item.title })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {items && items.length > 0 && (
        <div className="flex gap-4 text-sm text-muted-foreground flex-wrap">
          <span>{items.length} itens no total</span>
          <span>•</span>
          <span>{items.filter((i) => i.is_active).length} ativos</span>
          <span>•</span>
          <span>{items.filter((i) => i.is_global ?? true).length} globais</span>
          <span>•</span>
          <span className="text-green-600">{statusCounts['completed'] || 0} indexados</span>
          {(statusCounts['pending'] || 0) > 0 && (
            <>
              <span>•</span>
              <span className="text-yellow-600">{statusCounts['pending']} aguardando</span>
            </>
          )}
          {(statusCounts['failed'] || 0) > 0 && (
            <>
              <span>•</span>
              <span className="text-red-600">{statusCounts['failed']} com erro</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
