import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  User, 
  Loader2, 
  MessageSquarePlus, 
  Smartphone, 
  Users, 
  CheckSquare, 
  Square,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useTerminology } from "@/hooks/useTerminology";
import { useAuth } from "@/contexts/AuthContext";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingChats: any[];
  onConversationCreated: (chatId: string) => void;
  preSelectedLeadId?: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  existingChats,
  onConversationCreated,
  preSelectedLeadId,
}: NewConversationDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<any[]>([]);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, isActive: false });
  const { terminology } = useTerminology();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const workspaceId = profile?.workspace_id;

  // Fetch WhatsApp instances - filtered by workspace
  const { data: instances } = useQuery({
    queryKey: ["whatsapp-instances-connected", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_id, phone, status")
        .eq("status", "connected")
        .eq("workspace_id", workspaceId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Search leads - filtered by workspace
  const { data: leads, isLoading: isLoadingLeads } = useQuery({
    queryKey: ["leads-search", searchTerm, isMultiSelect, workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      let query = supabase
        .from("leads")
        .select("id, name, phone, email, metadata")
        .eq("workspace_id", workspaceId)
        .not("phone", "like", "%-%")
        .order("name", { ascending: true })
        .limit(isMultiSelect ? 500 : 50);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!workspaceId,
  });

  // Pre-select lead from URL param when dialog opens
  useEffect(() => {
    if (open && preSelectedLeadId && leads && leads.length > 0) {
      const leadToSelect = leads.find((l) => l.id === preSelectedLeadId);
      if (leadToSelect) {
        setSelectedLead(leadToSelect);
      }
    }
  }, [open, preSelectedLeadId, leads]);

  // Single conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLead || !message.trim()) {
        throw new Error("Selecione um cliente e escreva uma mensagem");
      }

      if (!instances || instances.length === 0) {
        throw new Error("Nenhuma conexão WhatsApp disponível");
      }

      const existingChat = existingChats?.find((c) => c.lead_id === selectedLead.id);
      const chatId = existingChat?.chat_id || selectedLead.phone;
      
      const instance = selectedInstance 
        ? instances.find((i) => i.id === selectedInstance) 
        : instances[0];

      const { data, error } = await supabase.functions.invoke("manual-inbox", {
        body: {
          chat_id: chatId,
          message: message.trim(),
          lead_id: selectedLead.id,
          user_id: user?.id,
          user_name: profile?.full_name || user?.email || "Usuário",
          instance_id: instance?.instance_id,
        },
      });

      if (error) {
        const errorMessage = (data as any)?.error || error.message || "Erro desconhecido";
        throw new Error(errorMessage);
      }

      return { chatId, isExisting: !!existingChat };
    },
    onSuccess: (result) => {
      if (result.isExisting) {
        toast.info("Conversa já existe. Abrindo...");
      } else {
        toast.success("Conversa iniciada!");
      }
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      onConversationCreated(result.chatId);
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao criar conversa");
    },
  });

  // Mass send mutation
  const massSendMutation = useMutation({
    mutationFn: async () => {
      if (selectedLeads.length === 0 || !message.trim()) {
        throw new Error("Selecione pelo menos um cliente e escreva uma mensagem");
      }

      if (!instances || instances.length === 0) {
        throw new Error("Nenhuma conexão WhatsApp disponível");
      }

      const instance = selectedInstance 
        ? instances.find((i) => i.id === selectedInstance) 
        : instances[0];

      setSendProgress({ current: 0, total: selectedLeads.length, isActive: true });

      const results = { success: 0, failed: 0 };

      for (let i = 0; i < selectedLeads.length; i++) {
        const lead = selectedLeads[i];
        const existingChat = existingChats?.find((c) => c.lead_id === lead.id);
        const chatId = existingChat?.chat_id || lead.phone;

        try {
          const { error } = await supabase.functions.invoke("manual-inbox", {
            body: {
              chat_id: chatId,
              message: message.trim(),
              lead_id: lead.id,
              user_id: user?.id,
              user_name: profile?.full_name || user?.email || "Usuário",
              instance_id: instance?.instance_id,
            },
          });

          if (error) {
            results.failed++;
          } else {
            results.success++;
          }
        } catch {
          results.failed++;
        }

        setSendProgress({ current: i + 1, total: selectedLeads.length, isActive: true });

        // Delay between sends to avoid rate limiting
        if (i < selectedLeads.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setSendProgress({ current: 0, total: 0, isActive: false });
      return results;
    },
    onSuccess: (results) => {
      if (results.failed === 0) {
        toast.success(`${results.success} mensagens enviadas com sucesso!`);
      } else {
        toast.warning(`Enviadas: ${results.success} | Falhas: ${results.failed}`);
      }
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      handleClose();
    },
    onError: (error) => {
      setSendProgress({ current: 0, total: 0, isActive: false });
      toast.error(error instanceof Error ? error.message : "Erro ao enviar mensagens");
    },
  });

  const handleClose = () => {
    setSearchTerm("");
    setSelectedLead(null);
    setSelectedInstance("");
    setMessage("");
    setIsMultiSelect(false);
    setSelectedLeads([]);
    setSendProgress({ current: 0, total: 0, isActive: false });
    onOpenChange(false);
  };

  const handleSelectLead = (lead: any) => {
    if (isMultiSelect) {
      setSelectedLeads(prev => {
        const exists = prev.find(l => l.id === lead.id);
        if (exists) {
          return prev.filter(l => l.id !== lead.id);
        }
        return [...prev, lead];
      });
    } else {
      setSelectedLead(lead);
    }
  };

  const handleSelectAll = () => {
    if (!leads) return;
    
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads([...leads]);
    }
  };

  const handleRemoveSelectedLead = (leadId: string) => {
    setSelectedLeads(prev => prev.filter(l => l.id !== leadId));
  };

  const handleModeChange = (checked: boolean) => {
    setIsMultiSelect(checked);
    setSelectedLead(null);
    setSelectedLeads([]);
  };

  const isLeadSelected = (leadId: string) => {
    return selectedLeads.some(l => l.id === leadId);
  };

  const canSend = isMultiSelect 
    ? selectedLeads.length > 0 && message.trim() && instances && instances.length > 0
    : selectedLead && message.trim() && instances && instances.length > 0;

  const isPending = createConversationMutation.isPending || massSendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-[500px] max-w-[95vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Nova Conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 min-w-0">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {isMultiSelect ? (
                <Users className="h-4 w-4 text-primary" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {isMultiSelect ? "Envio em Massa" : "Conversa Individual"}
              </span>
            </div>
            <Switch
              checked={isMultiSelect}
              onCheckedChange={handleModeChange}
              disabled={isPending}
            />
          </div>

          {/* WhatsApp Instance Selection */}
          {instances && instances.length > 1 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Instância WhatsApp
              </Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="w-full max-w-full">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.phone || instance.instance_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* No WhatsApp Connected Warning */}
          {(!instances || instances.length === 0) && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              Nenhuma conexão WhatsApp ativa. Conecte um WhatsApp antes de iniciar conversas.
            </div>
          )}

          {/* Lead Search */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {isMultiSelect ? `Selecionar ${terminology.plural}` : `Selecionar ${terminology.singular}`}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Buscar por nome ou telefone...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full max-w-full"
              />
            </div>
          </div>

          {/* Select All Button (Multi-select mode) */}
          {isMultiSelect && leads && leads.length > 0 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="text-xs"
                disabled={isPending}
              >
                {selectedLeads.length === leads.length ? (
                  <>
                    <Square className="h-3 w-3 mr-1" />
                    Desmarcar Todos
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3 w-3 mr-1" />
                    Selecionar Todos
                  </>
                )}
              </Button>
              <Badge variant="secondary" className="text-xs">
                {selectedLeads.length} selecionado{selectedLeads.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}

          {/* Lead List */}
          <div className="h-48 border rounded-lg overflow-hidden bg-background">
            <ScrollArea className="h-full">
              {isLoadingLeads ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : leads?.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                  Nenhum {terminology.singular.toLowerCase()} encontrado
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {leads?.map((lead) => {
                    const leadPhoto = (lead.metadata as any)?.photo;
                    const isSelected = isMultiSelect 
                      ? isLeadSelected(lead.id)
                      : selectedLead?.id === lead.id;

                    return (
                      <button
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        disabled={isPending}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-muted/50 hover:bg-accent"
                        } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isMultiSelect && (
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          {leadPhoto && <AvatarImage src={leadPhoto} />}
                          <AvatarFallback className="bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {lead.name || "Sem nome"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {lead.phone}
                          </p>
                        </div>
                        {!isMultiSelect && isSelected && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Selected Leads Display (Multi-select) */}
          {isMultiSelect && selectedLeads.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {selectedLeads.length} {terminology.plural.toLowerCase()} selecionado{selectedLeads.length !== 1 ? "s" : ""}
              </Label>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {selectedLeads.slice(0, 10).map((lead) => (
                  <Badge
                    key={lead.id}
                    variant="secondary"
                    className="text-xs pr-1 flex items-center gap-1"
                  >
                    <span className="truncate max-w-[100px]">
                      {lead.name || lead.phone}
                    </span>
                    <button
                      onClick={() => handleRemoveSelectedLead(lead.id)}
                      className="hover:bg-muted rounded p-0.5"
                      disabled={isPending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedLeads.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedLeads.length - 10} mais
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Selected Lead Display (Single) */}
          {!isMultiSelect && selectedLead && (
            <div className="bg-accent/50 rounded-lg p-3 flex items-center gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0">
                {(selectedLead.metadata as any)?.photo && (
                  <AvatarImage src={(selectedLead.metadata as any)?.photo} />
                )}
                <AvatarFallback className="bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedLead.name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground truncate">{selectedLead.phone}</p>
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-2">
            <Label>
              {isMultiSelect ? "Mensagem (será enviada para todos)" : "Primeira Mensagem"}
            </Label>
            <Textarea
              placeholder="Digite a mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={isPending}
              className="w-full max-w-full resize-none"
            />
          </div>

          {/* Send Progress */}
          {sendProgress.isActive && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Enviando mensagens...</span>
                <span className="text-muted-foreground">
                  {sendProgress.current}/{sendProgress.total}
                </span>
              </div>
              <Progress 
                value={(sendProgress.current / sendProgress.total) * 100} 
                className="h-2"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            className="w-full sm:w-auto"
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => isMultiSelect ? massSendMutation.mutate() : createConversationMutation.mutate()}
            disabled={!canSend || isPending}
            className="w-full sm:w-auto"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {sendProgress.isActive 
                  ? `${sendProgress.current}/${sendProgress.total}` 
                  : "Enviando..."}
              </>
            ) : isMultiSelect ? (
              `Enviar para ${selectedLeads.length} ${selectedLeads.length === 1 ? terminology.singular.toLowerCase() : terminology.plural.toLowerCase()}`
            ) : (
              "Iniciar Conversa"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
