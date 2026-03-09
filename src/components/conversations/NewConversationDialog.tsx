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
        .select("id, name, phone, email, metadata, avatar_url")
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
      <DialogContent className="w-[95vw] sm:w-[520px] max-w-[95vw] overflow-x-hidden p-0 gap-0">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-border/40">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20">
                <MessageSquarePlus className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <span className="text-base font-semibold">Nova Conversa</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">
                  {isMultiSelect ? "Envie para múltiplos contatos" : "Inicie uma conversa direta"}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5 min-w-0">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isMultiSelect ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                {isMultiSelect ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div>
                <span className="text-sm font-medium block">
                  {isMultiSelect ? "Envio em Massa" : "Conversa Individual"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {isMultiSelect ? "Selecione múltiplos destinatários" : "Conversa 1 para 1"}
                </span>
              </div>
            </div>
            <Switch
              checked={isMultiSelect}
              onCheckedChange={handleModeChange}
              disabled={isPending}
            />
          </div>

          {/* WhatsApp Instance Selection */}
          {instances && instances.length > 1 && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
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
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive flex items-center gap-2.5">
              <Smartphone className="h-4 w-4 shrink-0 opacity-70" />
              Nenhuma conexão WhatsApp ativa. Conecte um WhatsApp antes de iniciar conversas.
            </div>
          )}

          {/* Lead Search */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {isMultiSelect ? `Selecionar ${terminology.plural}` : `Selecionar ${terminology.singular}`}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Buscar por nome ou telefone..."
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
                className="text-xs h-7"
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
              <Badge variant="secondary" className="text-[10px] font-medium bg-primary/10 text-primary border-0">
                {selectedLeads.length} selecionado{selectedLeads.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}

          {/* Lead List */}
          <div className="h-56 rounded-xl border border-border/40 overflow-hidden">
            <ScrollArea className="h-full">
              {isLoadingLeads ? (
                <div className="flex flex-col items-center justify-center h-56 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                  <span className="text-xs text-muted-foreground">Buscando contatos...</span>
                </div>
              ) : leads?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 text-muted-foreground gap-1.5">
                  <User className="h-6 w-6 opacity-30" />
                  <span className="text-sm">Nenhum {terminology.singular.toLowerCase()} encontrado</span>
                </div>
              ) : (
                <div className="p-1.5 space-y-0.5">
                  {leads?.map((lead) => {
                    const leadPhoto = (lead as any).avatar_url || (lead.metadata as any)?.photo;
                    const isSelected = isMultiSelect
                      ? isLeadSelected(lead.id)
                      : selectedLead?.id === lead.id;
                    const initials = (lead.name || "?")
                      .split(" ")
                      .slice(0, 2)
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <button
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        disabled={isPending}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ${isSelected
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-muted/50"
                          } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {isMultiSelect && (
                          <div className="flex-shrink-0">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground/50" />
                            )}
                          </div>
                        )}
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          {leadPhoto && <AvatarImage src={leadPhoto} className="object-cover" />}
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {lead.name || "Sem nome"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {lead.phone}
                          </p>
                        </div>
                        {!isMultiSelect && isSelected && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
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
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
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
                      className="hover:bg-destructive/10 hover:text-destructive rounded p-0.5 transition-colors"
                      disabled={isPending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedLeads.length > 10 && (
                  <Badge variant="outline" className="text-xs border-dashed">
                    +{selectedLeads.length - 10} mais
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Selected Lead Display (Single) */}
          {!isMultiSelect && selectedLead && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
              <Avatar className="h-10 w-10 flex-shrink-0 ring-1 ring-primary/20">
                {((selectedLead as any).avatar_url || (selectedLead.metadata as any)?.photo) && (
                  <AvatarImage src={(selectedLead as any).avatar_url || (selectedLead.metadata as any)?.photo} className="object-cover" />
                )}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-semibold text-sm">
                  {(selectedLead.name || "?").split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{selectedLead.name || "Sem nome"}</p>
                <p className="text-sm text-muted-foreground truncate">{selectedLead.phone}</p>
              </div>
              <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-semibold shrink-0">
                Selecionado
              </Badge>
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
            <div className="space-y-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="font-medium">Enviando mensagens...</span>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {sendProgress.current}/{sendProgress.total}
                </span>
              </div>
              <Progress
                value={(sendProgress.current / sendProgress.total) * 100}
                className="h-1.5"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-6 py-4 border-t border-border/40">
          <Button
            variant="ghost"
            onClick={handleClose}
            className="w-full sm:w-auto"
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => isMultiSelect ? massSendMutation.mutate() : createConversationMutation.mutate()}
            disabled={!canSend || isPending}
            className="w-full sm:w-auto font-semibold"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {sendProgress.isActive
                  ? `${sendProgress.current}/${sendProgress.total}`
                  : "Enviando..."}
              </>
            ) : isMultiSelect ? (
              <>
                <Users className="h-4 w-4 mr-2" />
                {`Enviar para ${selectedLeads.length} ${selectedLeads.length === 1 ? terminology.singular.toLowerCase() : terminology.plural.toLowerCase()}`}
              </>
            ) : (
              <>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                Iniciar Conversa
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

