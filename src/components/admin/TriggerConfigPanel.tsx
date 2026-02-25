import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Zap, 
  Plus, 
  Clock, 
  UserX, 
  CalendarOff, 
  MessageSquare,
  CreditCard,
  Trash2,
  Edit
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

export interface WhatsAppTrigger {
  id: string;
  name: string;
  description: string | null;
  trigger_type: 'account_created' | 'trial_expired' | 'lead_inactive' | 'whatsapp_connected' | 'subscription_activated';
  conditions: TriggerConditions;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TriggerConditions {
  min_age_minutes?: number;
  max_age_minutes?: number;
  requires_no_whatsapp?: boolean;
  grace_period_days?: number;
  notify_immediately?: boolean;
  inactive_days?: number;
  workspace_id?: string | null;
  min_delay_minutes?: number;
}

interface TriggerConfigPanelProps {
  selectedTriggerId: string | null;
  onTriggerChange: (triggerId: string | null) => void;
  compact?: boolean;
}

const triggerTypeLabels: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  account_created: { 
    label: "Conta criada", 
    icon: <UserX className="h-4 w-4" />,
    description: "Dispara quando uma nova conta é criada"
  },
  trial_expired: { 
    label: "Trial expirado", 
    icon: <CalendarOff className="h-4 w-4" />,
    description: "Dispara quando o período de teste expira"
  },
  lead_inactive: { 
    label: "Lead inativo", 
    icon: <Clock className="h-4 w-4" />,
    description: "Dispara quando um lead fica sem atividade"
  },
  whatsapp_connected: { 
    label: "WhatsApp conectado", 
    icon: <MessageSquare className="h-4 w-4" />,
    description: "Dispara quando o usuário conecta o WhatsApp"
  },
  subscription_activated: { 
    label: "Assinatura ativada", 
    icon: <CreditCard className="h-4 w-4" />,
    description: "Dispara quando uma assinatura é ativada"
  },
};

export function TriggerConfigPanel({ 
  selectedTriggerId, 
  onTriggerChange,
  compact = false 
}: TriggerConfigPanelProps) {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WhatsAppTrigger | null>(null);
  const [newTrigger, setNewTrigger] = useState<{
    name: string;
    description: string;
    trigger_type: string;
    conditions: TriggerConditions;
  }>({
    name: "",
    description: "",
    trigger_type: "account_created",
    conditions: {},
  });

  // Fetch all triggers
  const { data: triggers, isLoading } = useQuery({
    queryKey: ["whatsapp-triggers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_triggers")
        .select("*")
        .order("name");
      
      if (error) throw error;
      return data as WhatsAppTrigger[];
    },
  });

  // Create trigger mutation
  const createMutation = useMutation({
    mutationFn: async (trigger: typeof newTrigger) => {
      const { error } = await supabase
        .from("whatsapp_triggers")
        .insert([{
          name: trigger.name,
          description: trigger.description || null,
          trigger_type: trigger.trigger_type,
          conditions: trigger.conditions as Json,
          enabled: true,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-triggers"] });
      setCreateDialogOpen(false);
      resetNewTrigger();
      toast.success("Gatilho criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar gatilho: " + error.message);
    },
  });

  // Update trigger mutation
  const updateMutation = useMutation({
    mutationFn: async (trigger: WhatsAppTrigger) => {
      const { error } = await supabase
        .from("whatsapp_triggers")
        .update({
          name: trigger.name,
          description: trigger.description,
          conditions: trigger.conditions as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("id", trigger.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-triggers"] });
      setEditDialogOpen(false);
      setEditingTrigger(null);
      toast.success("Gatilho atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Delete trigger mutation
  const deleteMutation = useMutation({
    mutationFn: async (triggerId: string) => {
      const { error } = await supabase
        .from("whatsapp_triggers")
        .delete()
        .eq("id", triggerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-triggers"] });
      if (selectedTriggerId === editingTrigger?.id) {
        onTriggerChange(null);
      }
      setEditDialogOpen(false);
      setEditingTrigger(null);
      toast.success("Gatilho excluído!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  const resetNewTrigger = () => {
    setNewTrigger({
      name: "",
      description: "",
      trigger_type: "account_created",
      conditions: {},
    });
  };

  const getDefaultConditions = (type: string): TriggerConditions => {
    switch (type) {
      case 'account_created':
        return { min_age_minutes: 5, max_age_minutes: 60, requires_no_whatsapp: true };
      case 'trial_expired':
        return { notify_immediately: true };
      case 'lead_inactive':
        return { inactive_days: 7 };
      case 'whatsapp_connected':
        return { min_delay_minutes: 1 };
      case 'subscription_activated':
        return {};
      default:
        return {};
    }
  };

  const handleTypeChange = (type: string, isEdit: boolean = false) => {
    const defaultConditions = getDefaultConditions(type);
    if (isEdit && editingTrigger) {
      setEditingTrigger({ ...editingTrigger, conditions: defaultConditions });
    } else {
      setNewTrigger(prev => ({ 
        ...prev, 
        trigger_type: type, 
        conditions: defaultConditions 
      }));
    }
  };

  const selectedTrigger = triggers?.find(t => t.id === selectedTriggerId);

  const renderConditionsEditor = (
    type: string, 
    conditions: TriggerConditions, 
    onChange: (conditions: TriggerConditions) => void
  ) => {
    switch (type) {
      case 'account_created':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Idade mínima da conta (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={conditions.min_age_minutes || 5}
                  onChange={(e) => onChange({ ...conditions, min_age_minutes: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Quanto tempo esperar após a criação</p>
              </div>
              <div className="space-y-2">
                <Label>Idade máxima da conta (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={conditions.max_age_minutes || 60}
                  onChange={(e) => onChange({ ...conditions, max_age_minutes: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Não disparar se conta for mais antiga</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires_no_whatsapp"
                checked={conditions.requires_no_whatsapp ?? true}
                onCheckedChange={(checked) => onChange({ ...conditions, requires_no_whatsapp: !!checked })}
              />
              <Label htmlFor="requires_no_whatsapp" className="text-sm">
                Apenas se não tiver WhatsApp conectado
              </Label>
            </div>
          </div>
        );

      case 'trial_expired':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Período de carência (dias)</Label>
              <Input
                type="number"
                min={0}
                value={conditions.grace_period_days || 0}
                onChange={(e) => onChange({ ...conditions, grace_period_days: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">Dias para esperar após expiração do trial</p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_immediately"
                checked={conditions.notify_immediately ?? true}
                onCheckedChange={(checked) => onChange({ ...conditions, notify_immediately: !!checked })}
              />
              <Label htmlFor="notify_immediately" className="text-sm">
                Notificar imediatamente ao expirar
              </Label>
            </div>
          </div>
        );

      case 'lead_inactive':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Dias sem atividade</Label>
              <Input
                type="number"
                min={1}
                value={conditions.inactive_days || 7}
                onChange={(e) => onChange({ ...conditions, inactive_days: parseInt(e.target.value) || 7 })}
              />
              <p className="text-xs text-muted-foreground">Dispara quando lead fica inativo por X dias</p>
            </div>
          </div>
        );

      case 'whatsapp_connected':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Espera mínima (minutos)</Label>
              <Input
                type="number"
                min={0}
                value={conditions.min_delay_minutes || 1}
                onChange={(e) => onChange({ ...conditions, min_delay_minutes: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Tempo para esperar após conexão antes de enviar</p>
            </div>
          </div>
        );

      case 'subscription_activated':
        return (
          <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            Este gatilho dispara automaticamente quando uma assinatura é ativada. Não há condições adicionais para configurar.
          </div>
        );

      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <Label className="font-medium">Gatilho Automático</Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Select 
            value={selectedTriggerId || "none"} 
            onValueChange={(value) => onTriggerChange(value === "none" ? null : value)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecionar gatilho..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum gatilho (manual)</SelectItem>
              {triggers?.map((trigger) => (
                <SelectItem key={trigger.id} value={trigger.id}>
                  <div className="flex items-center gap-2">
                    {triggerTypeLabels[trigger.trigger_type]?.icon}
                    <span>{trigger.name}</span>
                    {!trigger.enabled && (
                      <Badge variant="secondary" className="ml-1 text-xs">Inativo</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          
          {selectedTrigger && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                setEditingTrigger(selectedTrigger);
                setEditDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>

        {selectedTrigger && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {triggerTypeLabels[selectedTrigger.trigger_type]?.icon}
              <span className="font-medium">{selectedTrigger.name}</span>
            </div>
            {selectedTrigger.description && (
              <p className="text-muted-foreground">{selectedTrigger.description}</p>
            )}
            <div className="text-xs text-muted-foreground">
              <strong>Condições:</strong>{" "}
              {Object.entries(selectedTrigger.conditions)
                .filter(([, value]) => value !== null && value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ") || "Nenhuma"}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full panel view (not compact)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Gatilhos Automáticos</h3>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Novo Gatilho
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : triggers?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum gatilho configurado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers?.map((trigger) => (
            <div
              key={trigger.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedTriggerId === trigger.id 
                  ? 'border-primary bg-primary/5' 
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onTriggerChange(trigger.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {triggerTypeLabels[trigger.trigger_type]?.icon}
                  <span className="font-medium">{trigger.name}</span>
                  <Badge variant={trigger.enabled ? "default" : "secondary"}>
                    {trigger.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTrigger(trigger);
                    setEditDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              {trigger.description && (
                <p className="text-sm text-muted-foreground mt-1">{trigger.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Novo Gatilho</DialogTitle>
            <DialogDescription>
              Configure quando este template deve ser disparado automaticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Gatilho *</Label>
              <Input
                value={newTrigger.name}
                onChange={(e) => setNewTrigger(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Conta nova sem WhatsApp"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={newTrigger.description}
                onChange={(e) => setNewTrigger(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional do gatilho"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Gatilho *</Label>
              <Select 
                value={newTrigger.trigger_type} 
                onValueChange={(value) => handleTypeChange(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerTypeLabels).map(([type, { label, icon, description }]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {icon}
                        <div>
                          <div>{label}</div>
                          <div className="text-xs text-muted-foreground">{description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condições</Label>
              <div className="border rounded-lg p-4">
                {renderConditionsEditor(
                  newTrigger.trigger_type,
                  newTrigger.conditions,
                  (conditions) => setNewTrigger(prev => ({ ...prev, conditions }))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createMutation.mutate(newTrigger)}
              disabled={!newTrigger.name || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Gatilho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Gatilho</DialogTitle>
            <DialogDescription>
              Modifique as configurações do gatilho.
            </DialogDescription>
          </DialogHeader>
          
          {editingTrigger && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Gatilho *</Label>
                <Input
                  value={editingTrigger.name}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editingTrigger.description || ""}
                  onChange={(e) => setEditingTrigger({ ...editingTrigger, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Gatilho</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  {triggerTypeLabels[editingTrigger.trigger_type]?.icon}
                  <span>{triggerTypeLabels[editingTrigger.trigger_type]?.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">O tipo não pode ser alterado após criação</p>
              </div>

              <div className="space-y-2">
                <Label>Condições</Label>
                <div className="border rounded-lg p-4">
                  {renderConditionsEditor(
                    editingTrigger.trigger_type,
                    editingTrigger.conditions,
                    (conditions) => setEditingTrigger({ ...editingTrigger, conditions })
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="destructive" 
              onClick={() => {
                if (confirm("Tem certeza que deseja excluir este gatilho?")) {
                  deleteMutation.mutate(editingTrigger!.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateMutation.mutate(editingTrigger!)}
              disabled={!editingTrigger?.name || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
