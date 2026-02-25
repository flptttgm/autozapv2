import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppointmentNotificationDialog } from "./AppointmentNotificationDialog";
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

export interface AppointmentNotificationSettings {
  whatsapp_group_id?: string;
  group_name?: string;
  instance_id?: string;
  notify_on_new_appointment?: boolean;
  notify_on_appointment_confirmed?: boolean;
  notify_on_appointment_cancelled?: boolean;
  message_template?: string;
  enabled?: boolean;
}

interface AppointmentNotificationAutomationProps {
  workspaceId: string;
}

const DEFAULT_TEMPLATE = `📅 *NOVO AGENDAMENTO SOLICITADO*

👤 *Cliente:* {{cliente}}
📱 *WhatsApp:* {{telefone}}

🗓️ *Detalhes:*
• Título: {{titulo}}
• Data: {{data}}
• Horário: {{horario}}

⏰ *Solicitado em:* {{data_solicitacao}}

📌 *Acesse o painel para aprovar:*
{{painel}}`;

export const AppointmentNotificationAutomation = ({ workspaceId }: AppointmentNotificationAutomationProps) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch existing notification configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ["appointment-notification-settings", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "appointment_notification_settings")
        .maybeSingle();

      if (error) throw error;
      return data?.config_value as AppointmentNotificationSettings | null;
    },
  });

  // Toggle enabled status
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const newConfig = {
        ...config,
        enabled,
      };

      const { error } = await supabase
        .from("system_config")
        .update({
          config_value: newConfig as any,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId)
        .eq("config_key", "appointment_notification_settings");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-notification-settings"] });
      toast.success("Configuração atualizada");
    },
    onError: () => {
      toast.error("Erro ao atualizar configuração");
    },
  });

  // Delete configuration
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("system_config")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("config_key", "appointment_notification_settings");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointment-notification-settings"] });
      toast.success("Configuração excluída");
      setShowDeleteConfirm(false);
    },
    onError: () => {
      toast.error("Erro ao excluir configuração");
    },
  });

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  const hasConfig = !!config?.whatsapp_group_id;
  const isEnabled = config?.enabled !== false && hasConfig;

  const activeNotifications = [
    config?.notify_on_new_appointment && "Novos",
    config?.notify_on_appointment_confirmed && "Confirmados",
    config?.notify_on_appointment_cancelled && "Cancelados",
  ].filter(Boolean);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Notificações de Agendamento em Grupo</CardTitle>
              <CardDescription>
                Receba alertas automáticos no seu grupo quando houver novos agendamentos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasConfig ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {config.group_name || config.whatsapp_group_id}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {activeNotifications.map((notification) => (
                        <Badge key={notification} variant="secondary" className="text-xs">
                          {notification}
                        </Badge>
                      ))}
                      {activeNotifications.length === 0 && (
                        <span className="text-sm text-muted-foreground">
                          Nenhum evento configurado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled) => toggleMutation.mutate(enabled)}
                    disabled={toggleMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDialogOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg border-dashed">
              <CalendarCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Nenhuma automação configurada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure para receber alertas de novos agendamentos
              </p>
            </div>
          )}

          <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {hasConfig ? "Editar Configuração" : "Configurar Notificações"}
          </Button>
        </CardContent>
      </Card>

      <AppointmentNotificationDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        workspaceId={workspaceId}
        existingConfig={config || undefined}
        defaultTemplate={DEFAULT_TEMPLATE}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As notificações não serão mais
              enviadas para o grupo configurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
