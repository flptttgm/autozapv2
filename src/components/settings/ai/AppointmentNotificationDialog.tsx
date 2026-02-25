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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useConnectedWhatsAppInstances } from "@/hooks/useConnectedWhatsAppInstances";
import type { AppointmentNotificationSettings } from "./AppointmentNotificationAutomation";

interface AppointmentNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  existingConfig?: AppointmentNotificationSettings;
  defaultTemplate: string;
}

interface WhatsAppGroup {
  id: string;
  name: string;
  phone: string;
}

const TEMPLATE_VARIABLES = [
  { variable: "{{cliente}}", description: "Nome do cliente/lead" },
  { variable: "{{telefone}}", description: "Telefone formatado" },
  { variable: "{{titulo}}", description: "Título do agendamento" },
  { variable: "{{data}}", description: "Data do agendamento" },
  { variable: "{{horario}}", description: "Horário do agendamento" },
  { variable: "{{data_solicitacao}}", description: "Data/hora da solicitação" },
  { variable: "{{painel}}", description: "URL do painel" },
];

export const AppointmentNotificationDialog = ({
  open,
  onOpenChange,
  workspaceId,
  existingConfig,
  defaultTemplate,
}: AppointmentNotificationDialogProps) => {
  const queryClient = useQueryClient();
  const { instances, isLoading: loadingInstances } = useConnectedWhatsAppInstances(workspaceId);

  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [notifyOnNewAppointment, setNotifyOnNewAppointment] = useState(true);
  const [notifyOnAppointmentConfirmed, setNotifyOnAppointmentConfirmed] = useState(false);
  const [notifyOnAppointmentCancelled, setNotifyOnAppointmentCancelled] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);

  // Load existing config when dialog opens
  useEffect(() => {
    if (open && existingConfig) {
      setSelectedInstanceId(existingConfig.instance_id || "");
      setSelectedGroupId(existingConfig.whatsapp_group_id || "");
      setSelectedGroupName(existingConfig.group_name || "");
      setNotifyOnNewAppointment(existingConfig.notify_on_new_appointment ?? true);
      setNotifyOnAppointmentConfirmed(existingConfig.notify_on_appointment_confirmed || false);
      setNotifyOnAppointmentCancelled(existingConfig.notify_on_appointment_cancelled || false);
      setMessageTemplate(existingConfig.message_template || defaultTemplate);
    } else if (open && !existingConfig) {
      // Reset form for new config
      setSelectedInstanceId("");
      setSelectedGroupId("");
      setSelectedGroupName("");
      setNotifyOnNewAppointment(true);
      setNotifyOnAppointmentConfirmed(false);
      setNotifyOnAppointmentCancelled(false);
      setMessageTemplate(defaultTemplate);
    }
  }, [open, existingConfig, defaultTemplate]);

  // Get instance details
  const selectedInstance = instances.find(
    (inst) => inst.instance_id === selectedInstanceId
  );

  // Fetch groups for selected instance
  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ["whatsapp-groups", selectedInstanceId],
    queryFn: async () => {
      if (!selectedInstanceId || !selectedInstance) return [];

      const { data, error } = await supabase.functions.invoke("zapi-list-groups", {
        body: {
          instance_id: selectedInstanceId,
        },
      });

      if (error) throw error;
      return (data?.groups || []) as WhatsAppGroup[];
    },
    enabled: !!selectedInstanceId && !!selectedInstance,
  });

  // Save configuration
  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = {
        whatsapp_group_id: selectedGroupId,
        group_name: selectedGroupName,
        instance_id: selectedInstanceId,
        notify_on_new_appointment: notifyOnNewAppointment,
        notify_on_appointment_confirmed: notifyOnAppointmentConfirmed,
        notify_on_appointment_cancelled: notifyOnAppointmentCancelled,
        message_template: messageTemplate,
        enabled: true,
      };

      // Check if config exists first
      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "appointment_notification_settings")
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("system_config")
          .update({
            config_value: config as any,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", workspaceId)
          .eq("config_key", "appointment_notification_settings");

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("system_config")
          .insert({
            workspace_id: workspaceId,
            config_key: "appointment_notification_settings",
            config_value: config as any,
          } as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-notification-settings"] });
      toast.success("Configuração salva com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Error saving appointment notification config:", error);
      toast.error("Erro ao salvar configuração");
    },
  });

  const handleGroupSelect = (groupPhone: string) => {
    setSelectedGroupId(groupPhone);
    const group = groups?.find((g) => g.phone === groupPhone);
    setSelectedGroupName(group?.name || "");
  };

  const handleResetTemplate = () => {
    setMessageTemplate(defaultTemplate);
    toast.info("Template restaurado para o padrão");
  };

  const isFormValid =
    selectedInstanceId &&
    selectedGroupId &&
    (notifyOnNewAppointment || notifyOnAppointmentConfirmed || notifyOnAppointmentCancelled) &&
    messageTemplate.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingConfig?.whatsapp_group_id
              ? "Editar Notificações de Agendamento"
              : "Configurar Notificações de Agendamento"}
          </DialogTitle>
          <DialogDescription>
            Configure para receber alertas de agendamentos no seu grupo WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* WhatsApp Instance Selector */}
          <div className="space-y-2">
            <Label>Conexão WhatsApp</Label>
            {loadingInstances ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando conexões...
              </div>
            ) : instances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conexão WhatsApp ativa. Conecte primeiro na aba WhatsApp.
              </p>
            ) : (
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conexão" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((instance) => (
                    <SelectItem key={instance.instance_id} value={instance.instance_id}>
                      {instance.display_name || instance.phone || instance.instance_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Group Selector */}
          {selectedInstanceId && (
            <div className="space-y-2">
              <Label>Grupo WhatsApp</Label>
              {loadingGroups ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando grupos...
                </div>
              ) : groups && groups.length > 0 ? (
                <Select value={selectedGroupId} onValueChange={handleGroupSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.phone} value={group.phone}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum grupo encontrado nesta conexão
                </p>
              )}
            </div>
          )}

          {/* Event Checkboxes */}
          <div className="space-y-3">
            <Label>Notificar quando:</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-new-appointment"
                  checked={notifyOnNewAppointment}
                  onCheckedChange={(checked) => setNotifyOnNewAppointment(checked === true)}
                />
                <label
                  htmlFor="notify-new-appointment"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Novo agendamento for solicitado
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-appointment-confirmed"
                  checked={notifyOnAppointmentConfirmed}
                  onCheckedChange={(checked) => setNotifyOnAppointmentConfirmed(checked === true)}
                />
                <label
                  htmlFor="notify-appointment-confirmed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Agendamento for confirmado
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="notify-appointment-cancelled"
                  checked={notifyOnAppointmentCancelled}
                  onCheckedChange={(checked) => setNotifyOnAppointmentCancelled(checked === true)}
                />
                <label
                  htmlFor="notify-appointment-cancelled"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Agendamento for cancelado
                </label>
              </div>
            </div>
          </div>

          {/* Message Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensagem de Notificação</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetTemplate}
                className="text-xs h-7"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Restaurar padrão
              </Button>
            </div>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="Digite a mensagem de notificação..."
            />
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis (serão substituídas automaticamente):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map(({ variable, description }) => (
                    <Badge
                      key={variable}
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-muted"
                      onClick={() => {
                        setMessageTemplate((prev) => prev + variable);
                        toast.info(`${variable} adicionado`);
                      }}
                      title={description}
                    >
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isFormValid || saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
