import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Contact, Users, TrendingUp, Heart, Loader2 } from "lucide-react";
import { useTerminology, TerminologyType } from "@/hooks/useTerminology";

const TERMINOLOGY_OPTIONS = [
  {
    value: "contatos" as TerminologyType,
    label: "Contatos",
    description: "Para agendas e networking",
    icon: Contact,
  },
  {
    value: "clientes" as TerminologyType,
    label: "Clientes",
    description: "Padrão para negócios em geral",
    icon: Users,
  },
  {
    value: "leads" as TerminologyType,
    label: "Leads",
    description: "Para vendas e marketing",
    icon: TrendingUp,
  },
  {
    value: "pacientes" as TerminologyType,
    label: "Pacientes",
    description: "Para área da saúde",
    icon: Heart,
  },
];

export const TerminologySelector = () => {
  const queryClient = useQueryClient();
  const { type, isLoading, ownerWorkspaceId } = useTerminology();

  const updateMutation = useMutation({
    mutationFn: async (newType: TerminologyType) => {
      if (!ownerWorkspaceId) throw new Error("Workspace não encontrado");

      // Check if config exists for the owner's primary workspace
      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("config_key", "entity_terminology")
        .eq("workspace_id", ownerWorkspaceId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("system_config")
          .update({
            config_value: { type: newType },
            updated_at: new Date().toISOString()
          })
          .eq("config_key", "entity_terminology")
          .eq("workspace_id", ownerWorkspaceId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_config")
          .insert({
            config_key: "entity_terminology",
            config_value: { type: newType },
            workspace_id: ownerWorkspaceId,
          });
        if (error) throw error;
      }

      return newType;
    },
    onSuccess: async () => {
      toast.success("Terminologia atualizada!");

      // Invalidate all terminology-related queries
      await queryClient.invalidateQueries({ queryKey: ["terminology_config"] });

      // Force page reload after a short delay to show toast
      setTimeout(() => {
        window.location.reload();
      }, 300);
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const isPending = updateMutation.isPending;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse h-32 bg-muted rounded"></div>
      </Card>
    );
  }

  return (
    <Card className="p-6 relative">
      {isPending && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Aplicando...</span>
          </div>
        </div>
      )}

      <h2 className="text-xl sm:text-2xl font-semibold mb-2">Terminologia</h2>
      <p className="text-muted-foreground mb-6 text-sm sm:text-base">
        Escolha como deseja chamar seus contatos na plataforma
      </p>

      <RadioGroup
        value={type}
        onValueChange={(value) => {
          if (value !== type && !isPending) {
            updateMutation.mutate(value as TerminologyType);
          }
        }}
        disabled={isPending}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {TERMINOLOGY_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Label
              key={option.value}
              htmlFor={option.value}
              className={`flex flex-col items-center gap-3 p-4 border rounded-lg transition-all ${isPending
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
                } ${type === option.value
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border hover:border-primary/50"
                }`}
            >
              <RadioGroupItem
                value={option.value}
                id={option.value}
                className="sr-only"
                disabled={isPending}
              />
              <Icon className={`h-8 w-8 ${type === option.value ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </Label>
          );
        })}
      </RadioGroup>

      <p className="text-sm text-muted-foreground mt-4">
        💡 Essa configuração altera o nome da página e menus em todos os workspaces
      </p>
    </Card>
  );
};
