import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, FileText, Receipt, LayoutGrid } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface PageVisibility {
  appointments: boolean;
  quotes: boolean;
  invoices: boolean;
}

const DEFAULT_VISIBILITY: PageVisibility = {
  appointments: true,
  quotes: true,
  invoices: true,
};

const PAGES_CONFIG = [
  {
    key: "appointments" as const,
    label: "Agendamentos",
    description: "Gerencie compromissos e horários",
    icon: Calendar,
  },
  {
    key: "quotes" as const,
    label: "Orçamentos",
    description: "Visualize propostas comerciais da IA",
    icon: FileText,
  },
  {
    key: "invoices" as const,
    label: "Cobranças",
    description: "Gerencie faturas e pagamentos",
    icon: Receipt,
  },
];

export const SidebarPagesVisibility = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const workspaceId = profile?.workspace_id;

  const [visibility, setVisibility] = useState<PageVisibility>(DEFAULT_VISIBILITY);

  const { data: savedVisibility, isLoading } = useQuery({
    queryKey: ["sidebar-visibility", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return DEFAULT_VISIBILITY;

      const { data } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "sidebar_pages_visibility")
        .maybeSingle();

      if (!data?.config_value) return DEFAULT_VISIBILITY;

      const configValue = data.config_value as Record<string, boolean>;
      return {
        appointments: configValue.appointments ?? true,
        quotes: configValue.quotes ?? true,
        invoices: configValue.invoices ?? true,
      };
    },
    enabled: !!workspaceId,
  });

  useEffect(() => {
    if (savedVisibility) {
      setVisibility(savedVisibility);
    }
  }, [savedVisibility]);

  const updateMutation = useMutation({
    mutationFn: async (newVisibility: PageVisibility) => {
      if (!workspaceId) throw new Error("Workspace não encontrado");

      const { data: existing } = await supabase
        .from("system_config")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("config_key", "sidebar_pages_visibility")
        .maybeSingle();

      const configValueJson: Json = {
        appointments: newVisibility.appointments,
        quotes: newVisibility.quotes,
        invoices: newVisibility.invoices,
      };

      if (existing) {
        const { error } = await supabase
          .from("system_config")
          .update({ config_value: configValueJson })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("system_config")
          .insert({
            workspace_id: workspaceId,
            config_key: "sidebar_pages_visibility",
            config_value: configValueJson,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sidebar-visibility"] });
      toast.success("Configuração salva!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const handleToggle = (key: keyof PageVisibility) => {
    const newVisibility = {
      ...visibility,
      [key]: !visibility[key],
    };
    setVisibility(newVisibility);
    updateMutation.mutate(newVisibility);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-2">
        <LayoutGrid className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Páginas da Sidebar</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Escolha quais páginas aparecem na navegação. Os dados salvos não serão apagados.
      </p>

      <div className="space-y-3">
        {PAGES_CONFIG.map(({ key, label, description, icon: Icon }) => (
          <div
            key={key}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label htmlFor={`toggle-${key}`} className="font-medium cursor-pointer">
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              id={`toggle-${key}`}
              checked={visibility[key]}
              onCheckedChange={() => handleToggle(key)}
              disabled={updateMutation.isPending}
            />
          </div>
        ))}
      </div>
    </Card>
  );
};
