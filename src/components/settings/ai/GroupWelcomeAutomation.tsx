import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GroupWelcomeDialog } from "./GroupWelcomeDialog";
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
  created_at: string;
}

interface GroupWelcomeAutomationProps {
  workspaceId: string;
}

export const GroupWelcomeAutomation = ({ workspaceId }: GroupWelcomeAutomationProps) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<GroupWelcomeConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch existing welcome configurations
  const { data: configs, isLoading } = useQuery({
    queryKey: ["group-welcome-configs", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_welcome_messages")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as GroupWelcomeConfig[];
    },
  });

  // Toggle enabled status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("group_welcome_messages")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-welcome-configs"] });
      toast.success("Configuração atualizada");
    },
    onError: () => {
      toast.error("Erro ao atualizar configuração");
    },
  });

  // Delete configuration
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("group_welcome_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-welcome-configs"] });
      toast.success("Configuração excluída");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir configuração");
    },
  });

  const handleEdit = (config: GroupWelcomeConfig) => {
    setEditingConfig(config);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingConfig(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Boas-Vindas em Grupos/Comunidades</CardTitle>
              <CardDescription>
                Envie mensagens automáticas quando novos membros entrarem nos seus grupos WhatsApp
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configurations List */}
          {configs && configs.length > 0 ? (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {config.group_name || config.group_phone}
                      </p>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {config.message.substring(0, 60)}
                        {config.message.length > 60 ? "..." : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {config.send_private && (
                          <Badge variant="secondary" className="text-xs">
                            Privado
                          </Badge>
                        )}
                        {config.delay_seconds > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Delay: {config.delay_seconds}s
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(enabled) =>
                        toggleMutation.mutate({ id: config.id, enabled })
                      }
                      disabled={toggleMutation.isPending}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(config)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(config.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg border-dashed">
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Nenhuma automação configurada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure mensagens de boas-vindas para seus grupos WhatsApp
              </p>
            </div>
          )}

          {/* Add Button */}
          <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Grupo
          </Button>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <GroupWelcomeDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        workspaceId={workspaceId}
        editingConfig={editingConfig}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir configuração?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A mensagem de boas-vindas não será
              mais enviada para novos membros deste grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
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
