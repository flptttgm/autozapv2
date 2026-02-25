import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Bell, Clock, MessageSquare } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface AppointmentRemindersProps {
  workspaceId: string;
}

interface ReminderSettings {
  enabled: boolean;
  hours_before: number[];
}

const REMINDER_OPTIONS = [
  { value: 24, label: "24 horas antes" },
  { value: 12, label: "12 horas antes" },
  { value: 2, label: "2 horas antes" },
  { value: 1, label: "1 hora antes" },
];

export function AppointmentReminders({ workspaceId }: AppointmentRemindersProps) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [selectedHours, setSelectedHours] = useState<number[]>([24, 1]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["appointment-reminders", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "appointment_reminders")
        .maybeSingle();

      if (error) throw error;
      if (!data?.config_value) return null;
      
      const value = data.config_value as unknown as ReminderSettings;
      return value;
    },
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled ?? true);
      setSelectedHours(settings.hours_before ?? [24, 1]);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (newSettings: ReminderSettings) => {
      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "appointment_reminders")
        .maybeSingle();

      const configValue: Json = {
        enabled: newSettings.enabled,
        hours_before: newSettings.hours_before
      };

      if (existing) {
        const { error } = await supabase
          .from("system_config")
          .update({ 
            config_value: configValue,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_config")
          .insert([{
            workspace_id: workspaceId,
            config_key: "appointment_reminders",
            config_value: configValue,
            description: "Configurações de lembretes de agendamento via WhatsApp"
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configurações de lembrete salvas!");
      queryClient.invalidateQueries({ queryKey: ["appointment-reminders"] });
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const handleToggleHour = (hour: number) => {
    setSelectedHours(prev => 
      prev.includes(hour) 
        ? prev.filter(h => h !== hour)
        : [...prev, hour].sort((a, b) => b - a)
    );
  };

  const handleSave = () => {
    saveMutation.mutate({
      enabled,
      hours_before: selectedHours,
    });
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Carregando...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        <h2 className="text-xl sm:text-2xl font-semibold">Lembretes de Agendamento</h2>
      </div>
      
      <p className="text-muted-foreground mb-6 text-sm sm:text-base">
        Envie lembretes automáticos por WhatsApp antes dos agendamentos
      </p>

      <div className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="reminders-enabled">Ativar lembretes automáticos</Label>
          </div>
          <Switch
            id="reminders-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Reminder Times */}
        <div className={!enabled ? "opacity-50 pointer-events-none" : ""}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label>Quando enviar lembretes</Label>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {REMINDER_OPTIONS.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={`reminder-${option.value}`}
                  checked={selectedHours.includes(option.value)}
                  onCheckedChange={() => handleToggleHour(option.value)}
                />
                <Label 
                  htmlFor={`reminder-${option.value}`}
                  className="cursor-pointer flex-1"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        {enabled && selectedHours.length > 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground mb-2">
              Exemplo de lembrete:
            </p>
            <div className="text-sm bg-background p-3 rounded-md border">
              ⏰ Lembrete: Você tem um agendamento amanhã!<br/><br/>
              📅 Consulta inicial<br/>
              🗓️ segunda-feira, 16/12/2024<br/>
              ⏰ 14:00<br/><br/>
              Nos vemos em breve!
            </div>
          </div>
        )}

        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          className="w-full"
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </Card>
  );
}
