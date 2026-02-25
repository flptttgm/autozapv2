import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface GroupWelcomeConfig {
  id: string;
  workspace_id: string;
  instance_id: string | null;
  group_phone: string;
  group_name: string | null;
  message: string;
  enabled: boolean;
  send_private: boolean;
  delay_seconds: number;
}

interface GroupOption {
  phone: string;
  name: string;
  participantsCount?: number;
  isAnnouncement?: boolean;
}

interface GroupWelcomeDialogProps {
  open: boolean;
  onOpenChange: () => void;
  workspaceId: string;
  editingConfig: GroupWelcomeConfig | null;
}

const AVAILABLE_VARIABLES = [
  { key: "{{nome_grupo}}", label: "Nome do Grupo", description: "Nome do grupo/comunidade" },
  { key: "{{telefone}}", label: "Telefone", description: "Número do novo membro" },
  { key: "{{data}}", label: "Data", description: "Data atual" },
];

export const GroupWelcomeDialog = ({
  open,
  onOpenChange,
  workspaceId,
  editingConfig,
}: GroupWelcomeDialogProps) => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [groupName, setGroupName] = useState<string>("");
  const [message, setMessage] = useState<string>(
    "Olá! 👋 Bem-vindo(a) ao {{nome_grupo}}! Qualquer dúvida, estamos à disposição."
  );
  const [sendPrivate, setSendPrivate] = useState<boolean>(false);
  const [delaySeconds, setDelaySeconds] = useState<number>(3);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");

  // Fetch WhatsApp instances
  const { data: instances } = useQuery({
    queryKey: ["whatsapp-instances", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_id, phone, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "connected");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch groups from selected instance
  const { data: groups, isLoading: isLoadingGroups } = useQuery({
    queryKey: ["whatsapp-groups", selectedInstanceId],
    queryFn: async () => {
      if (!selectedInstanceId) return [];

      const { data, error } = await supabase.functions.invoke("zapi-list-groups", {
        body: { instance_id: selectedInstanceId },
      });

      if (error) throw error;
      return (data?.groups || []) as GroupOption[];
    },
    enabled: open && !!selectedInstanceId,
  });

  // Set initial values when editing
  useEffect(() => {
    if (editingConfig) {
      setSelectedGroup(editingConfig.group_phone);
      setGroupName(editingConfig.group_name || "");
      setMessage(editingConfig.message);
      setSendPrivate(editingConfig.send_private);
      setDelaySeconds(editingConfig.delay_seconds);
      setSelectedInstanceId(editingConfig.instance_id || "");
    } else {
      // Reset form
      setSelectedGroup("");
      setGroupName("");
      setMessage("Olá! 👋 Bem-vindo(a) ao {{nome_grupo}}! Qualquer dúvida, estamos à disposição.");
      setSendPrivate(false);
      setDelaySeconds(3);
      // Auto-select first connected instance
      if (instances && instances.length > 0) {
        setSelectedInstanceId(instances[0].id);
      }
    }
  }, [editingConfig, instances, open]);

  // Update group name when group is selected
  useEffect(() => {
    if (selectedGroup && groups) {
      const group = groups.find((g) => g.phone === selectedGroup);
      if (group) {
        setGroupName(group.name);
      }
    }
  }, [selectedGroup, groups]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup || !message.trim()) {
        throw new Error("Preencha todos os campos obrigatórios");
      }

      const configData = {
        workspace_id: workspaceId,
        instance_id: selectedInstanceId || null,
        group_phone: selectedGroup,
        group_name: groupName || null,
        message: message.trim(),
        enabled: true,
        send_private: sendPrivate,
        delay_seconds: delaySeconds,
        updated_at: new Date().toISOString(),
      };

      if (editingConfig) {
        // Update existing
        const { error } = await supabase
          .from("group_welcome_messages")
          .update(configData)
          .eq("id", editingConfig.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("group_welcome_messages")
          .insert(configData);

        if (error) {
          if (error.code === "23505") {
            throw new Error("Já existe uma configuração para este grupo");
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-welcome-configs"] });
      toast.success(
        editingConfig ? "Configuração atualizada!" : "Configuração criada!"
      );
      onOpenChange();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao salvar configuração");
    },
  });

  const insertVariable = (variable: string) => {
    setMessage((prev) => prev + " " + variable);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? "Editar Boas-Vindas" : "Nova Mensagem de Boas-Vindas"}
          </DialogTitle>
          <DialogDescription>
            Configure uma mensagem automática para novos membros do grupo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instance Selector */}
          {instances && instances.length > 1 && (
            <div className="space-y-2">
              <Label>Conexão WhatsApp</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.phone || inst.instance_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Group Selector */}
          <div className="space-y-2">
            <Label>Grupo *</Label>
            {isLoadingGroups ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando grupos...
              </div>
            ) : (
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups && groups.length > 0 ? (
                    groups.map((group) => (
                      <SelectItem key={group.phone} value={group.phone}>
                        <div className="flex items-center gap-2">
                          <span>{group.name}</span>
                          {group.isAnnouncement && (
                            <Badge variant="secondary" className="text-xs">
                              Comunidade
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_none" disabled>
                      {selectedInstanceId
                        ? "Nenhum grupo encontrado"
                        : "Selecione uma conexão primeiro"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {!selectedInstanceId && instances && instances.length === 0 && (
              <p className="text-sm text-amber-600 flex items-center gap-1">
                <Info className="h-4 w-4" />
                Conecte seu WhatsApp primeiro para ver seus grupos
              </p>
            )}
          </div>

          {/* Manual Group Phone Input (for editing or if no groups loaded) */}
          {editingConfig && (
            <div className="space-y-2">
              <Label>ID do Grupo</Label>
              <Input
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                placeholder="5511999999999-group@g.us"
                disabled
              />
            </div>
          )}

          {/* Message Editor */}
          <div className="space-y-2">
            <Label>Mensagem *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem de boas-vindas..."
              rows={4}
              className="resize-none"
            />
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_VARIABLES.map((variable) => (
                <Badge
                  key={variable.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                  onClick={() => insertVariable(variable.key)}
                  title={variable.description}
                >
                  {variable.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Clique nas variáveis acima para inserir na mensagem
            </p>
          </div>

          {/* Options */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enviar no privado (DM)</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar a mensagem diretamente no chat privado do novo membro
                </p>
              </div>
              <Switch checked={sendPrivate} onCheckedChange={setSendPrivate} />
            </div>

            <div className="space-y-2">
              <Label>Delay antes de enviar (segundos)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 0)}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Aguardar alguns segundos antes de enviar pode parecer mais natural
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !selectedGroup || !message.trim()}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {editingConfig ? "Salvar Alterações" : "Criar Automação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
