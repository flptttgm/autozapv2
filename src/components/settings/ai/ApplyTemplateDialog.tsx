import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Smartphone, Globe, Check, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppInstance {
  id: string;
  instance_id: string;
  display_name: string | null;
  phone: string | null;
  status: string | null;
  ai_template_id: string | null;
}

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: string;
    name: string;
    config: any;
  } | null;
  workspaceId: string;
  onApplyToWorkspace: (config: any) => void;
}

export const ApplyTemplateDialog = ({
  open,
  onOpenChange,
  template,
  workspaceId,
  onApplyToWorkspace,
}: ApplyTemplateDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<string>("workspace");
  const { subscription } = useSubscription();
  const isSingleInstancePlan = subscription?.plan_type === 'trial' || subscription?.plan_type === 'start';

  // Fetch WhatsApp instances
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_id, display_name, phone, status, ai_template_id")
        .eq("workspace_id", workspaceId)
        .order("connected_at", { ascending: false });

      if (error) throw error;
      return data as WhatsAppInstance[];
    },
    enabled: open && !!workspaceId,
  });

  // Apply template to instance mutation
  const applyToInstanceMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      if (!template) throw new Error("Template not found");

      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ ai_template_id: template.id })
        .eq("id", instanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      const instance = instances.find(i => i.id === selectedTarget);
      const instanceName = instance?.display_name || instance?.phone || "Instância";
      toast.success(`Template "${template?.name}" aplicado à ${instanceName}!`);
      onOpenChange(false);
      setSelectedTarget("workspace");
    },
    onError: (error) => {
      console.error("Error applying template to instance:", error);
      toast.error("Erro ao aplicar template à instância");
    },
  });

  const handleApply = () => {
    if (!template) return;

    if (selectedTarget === "workspace") {
      onApplyToWorkspace({
        ...template.config,
        template: `custom_${template.id}`,
      });
      toast.success(`Template "${template.name}" aplicado ao workspace!`);
      onOpenChange(false);
      setSelectedTarget("workspace");
    } else {
      applyToInstanceMutation.mutate(selectedTarget);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "";
    // Format as (XX) XXXXX-XXXX
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  const isApplying = applyToInstanceMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar Template</DialogTitle>
          <DialogDescription>
            Escolha onde aplicar o template "{template?.name}"
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-4">
            <RadioGroup
              value={selectedTarget}
              onValueChange={setSelectedTarget}
              className="space-y-3"
            >
              {/* Workspace option */}
              <div
                className={cn(
                  "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                  selectedTarget === "workspace"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                )}
                onClick={() => setSelectedTarget("workspace")}
              >
                <RadioGroupItem value="workspace" id="workspace" />
                <Label
                  htmlFor="workspace"
                  className="flex-1 cursor-pointer flex items-center gap-3"
                >
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium">Workspace (global)</p>
                    <p className="text-sm text-muted-foreground">
                      Aplica às configurações gerais
                    </p>
                  </div>
                </Label>
              </div>

              {/* Only show instance options for multi-instance plans */}
              {!isSingleInstancePlan && (
                <>
                  {/* Divider */}
                  {instances.length > 0 && (
                    <div className="relative py-2">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          ou instância específica
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Instance options */}
                  {instances.map((instance) => {
                    const isConnected = instance.status === "connected";
                    const displayName = instance.display_name || formatPhone(instance.phone) || instance.instance_id;
                    const hasTemplate = instance.ai_template_id === template?.id;

                    return (
                      <div
                        key={instance.id}
                        className={cn(
                          "flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors",
                          selectedTarget === instance.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                        onClick={() => setSelectedTarget(instance.id)}
                      >
                        <RadioGroupItem value={instance.id} id={instance.id} />
                        <Label
                          htmlFor={instance.id}
                          className="flex-1 cursor-pointer flex items-center gap-3"
                        >
                          <div className={cn(
                            "p-2 rounded-full",
                            isConnected 
                              ? "bg-green-500/10 text-green-600" 
                              : "bg-muted text-muted-foreground"
                          )}>
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{displayName}</p>
                            <div className="flex items-center gap-2 text-sm">
                              {isConnected ? (
                                <span className="text-green-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  Conectado
                                </span>
                              ) : (
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <WifiOff className="w-3 h-3" />
                                  Desconectado
                                </span>
                              )}
                              {hasTemplate && (
                                <span className="text-primary flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Template ativo
                                </span>
                              )}
                            </div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}

                  {instances.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Nenhuma instância WhatsApp encontrada.
                      <br />
                      O template será aplicado ao workspace.
                    </div>
                  )}
                </>
              )}
            </RadioGroup>
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              setSelectedTarget("workspace");
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={isApplying || isLoading}
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              "Aplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
