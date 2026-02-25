import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Plus, X, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BehaviorSettingsProps {
  behavior: {
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
  onUpdate: (behavior: any) => void;
}

export const BehaviorSettings = ({ behavior, onUpdate }: BehaviorSettingsProps) => {
  const [localBehavior, setLocalBehavior] = useState(behavior || {
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
  });
  const [newKeyword, setNewKeyword] = useState("");
  const [newAppointmentKeyword, setNewAppointmentKeyword] = useState("");

  useEffect(() => {
    if (behavior) {
      setLocalBehavior({
        ...behavior,
        business_hours: {
          enabled: behavior.business_hours?.enabled ?? false,
          start: behavior.business_hours?.start || "00:00",
          end: behavior.business_hours?.end || "23:59",
          weekdays_only: behavior.business_hours?.weekdays_only ?? false,
        },
        human_transfer_keywords: behavior.human_transfer_keywords || [],
        appointment_keywords: behavior.appointment_keywords || [],
        respond_in_groups: behavior.respond_in_groups ?? false,
        group_mention_only: behavior.group_mention_only ?? true,
        group_mention_trigger: behavior.group_mention_trigger || "@assistente",
        message_buffer_timeout: behavior.message_buffer_timeout ?? 30,
      });
    }
  }, [behavior]);

  const handleSave = () => {
    onUpdate(localBehavior);
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      setLocalBehavior({
        ...localBehavior,
        human_transfer_keywords: [...(localBehavior.human_transfer_keywords || []), newKeyword.trim()],
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setLocalBehavior({
      ...localBehavior,
      human_transfer_keywords: (localBehavior.human_transfer_keywords || []).filter((k) => k !== keyword),
    });
  };

  const addAppointmentKeyword = () => {
    if (newAppointmentKeyword.trim()) {
      setLocalBehavior({
        ...localBehavior,
        appointment_keywords: [...(localBehavior.appointment_keywords || []), newAppointmentKeyword.trim()],
      });
      setNewAppointmentKeyword("");
    }
  };

  const removeAppointmentKeyword = (keyword: string) => {
    setLocalBehavior({
      ...localBehavior,
      appointment_keywords: (localBehavior.appointment_keywords || []).filter((k) => k !== keyword),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold mb-2">Comportamento Avançado</h3>
        <p className="text-muted-foreground">
          Configure regras especiais e automações
        </p>
      </div>

      <div className="space-y-6">
        {/* Business Hours Toggle + Settings */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Label htmlFor="limit-hours" className="text-base font-medium">Limitar horário de atendimento</Label>
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
              id="limit-hours"
              checked={localBehavior.business_hours.enabled ?? false}
              onCheckedChange={(checked) =>
                setLocalBehavior({
                  ...localBehavior,
                  business_hours: { ...localBehavior.business_hours, enabled: checked },
                })
              }
              className="self-end sm:self-auto"
            />
          </div>

          {localBehavior.business_hours.enabled && (
            <div className="ml-2 pl-2 sm:ml-4 sm:pl-4 border-l-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label htmlFor="start-time" className="text-sm">Início</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={localBehavior.business_hours.start}
                    onChange={(e) =>
                      setLocalBehavior({
                        ...localBehavior,
                        business_hours: { ...localBehavior.business_hours, start: e.target.value },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="end-time" className="text-sm">Término</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={localBehavior.business_hours.end}
                    onChange={(e) =>
                      setLocalBehavior({
                        ...localBehavior,
                        business_hours: { ...localBehavior.business_hours, end: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="weekdays-only" className="text-sm">Apenas dias de semana</Label>
                <Switch
                  id="weekdays-only"
                  checked={localBehavior.business_hours.weekdays_only}
                  onCheckedChange={(checked) =>
                    setLocalBehavior({
                      ...localBehavior,
                      business_hours: { ...localBehavior.business_hours, weekdays_only: checked },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="out-of-hours">Mensagem Fora do Horário</Label>
                <Textarea
                  id="out-of-hours"
                  value={localBehavior.out_of_hours_message}
                  onChange={(e) => setLocalBehavior({ ...localBehavior, out_of_hours_message: e.target.value })}
                  placeholder="Mensagem enviada quando cliente entrar em contato fora do horário de atendimento"
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label>Palavras-chave para Transferência Humana</Label>
          <p className="text-sm text-muted-foreground">
            Quando detectar estas palavras, a I.A. sugerirá falar com um atendente
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Digite uma palavra-chave"
              onKeyPress={(e) => e.key === "Enter" && addKeyword()}
              className="flex-1"
            />
            <Button type="button" onClick={addKeyword} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2 sm:mr-0" />
              <span className="sm:hidden">Adicionar</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(localBehavior.human_transfer_keywords || []).map((keyword) => (
              <Badge key={keyword} variant="secondary" className="gap-1">
                {keyword}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => removeKeyword(keyword)}
                />
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-responses">Limite de Respostas Automáticas</Label>
          <Input
            id="max-responses"
            type="number"
            min="1"
            max="50"
            value={localBehavior.max_auto_responses}
            onChange={(e) =>
              setLocalBehavior({ ...localBehavior, max_auto_responses: parseInt(e.target.value) })
            }
          />
          <p className="text-sm text-muted-foreground">
            Após este número de mensagens, notificar equipe para intervenção humana
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="appointment-detection">Detecção de Agendamento</Label>
              <p className="text-sm text-muted-foreground">
                Identificar automaticamente intenção de agendar
              </p>
            </div>
            <Switch
              id="appointment-detection"
              checked={localBehavior.appointment_detection}
              onCheckedChange={(checked) =>
                setLocalBehavior({ ...localBehavior, appointment_detection: checked })
              }
            />
          </div>

          {localBehavior.appointment_detection && (
            <div className="space-y-3 ml-4 pl-4 border-l-2">
              <Label>Palavras-chave de Agendamento</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newAppointmentKeyword}
                  onChange={(e) => setNewAppointmentKeyword(e.target.value)}
                  placeholder="Ex: agendar, marcar, consulta"
                  onKeyPress={(e) => e.key === "Enter" && addAppointmentKeyword()}
                  className="flex-1"
                />
                <Button type="button" onClick={addAppointmentKeyword} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2 sm:mr-0" />
                  <span className="sm:hidden">Adicionar</span>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(localBehavior.appointment_keywords || []).map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeAppointmentKeyword(keyword)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
        )}
        </div>

        {/* Configurações de Grupos */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div>
            <Label htmlFor="respond-in-groups" className="text-base font-medium">Responder em Grupos</Label>
            <p className="text-sm text-muted-foreground">
              Ativar respostas automáticas da I.A. em grupos de WhatsApp
            </p>
          </div>
          <Switch
            id="respond-in-groups"
            checked={localBehavior.respond_in_groups}
            onCheckedChange={(checked) =>
              setLocalBehavior({ ...localBehavior, respond_in_groups: checked })
            }
          />
        </div>

        {/* Timeout do Buffer de Mensagens */}
        <div className="space-y-2">
          <Label htmlFor="buffer-timeout">Timeout do Buffer de Mensagens</Label>
          <Input
            id="buffer-timeout"
            type="number"
            min="5"
            max="120"
            value={localBehavior.message_buffer_timeout}
            onChange={(e) =>
              setLocalBehavior({ ...localBehavior, message_buffer_timeout: parseInt(e.target.value) || 30 })
            }
          />
          <p className="text-sm text-muted-foreground">
            Tempo em segundos para aguardar mensagens fragmentadas antes de processar (5-120 segundos)
          </p>
        </div>
      </div>

      <Button onClick={handleSave} className="w-full">
        Salvar Configurações
      </Button>
    </div>
  );
};
