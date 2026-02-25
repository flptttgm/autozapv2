import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Trash2, Loader2, AlertTriangle, Users, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface OtherWorkspace {
  id: string;
  name: string;
  created_at: string;
  subscription_status: string;
  plan_type: string;
  leads_count: number;
  messages_count: number;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  trial: { label: "Trial", variant: "secondary" },
  expired: { label: "Expirado", variant: "destructive" },
  trial_expired: { label: "Trial Expirado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "outline" },
  overdue: { label: "Atrasado", variant: "destructive" },
};

const PLAN_NAMES: Record<string, string> = {
  trial: "Trial",
  start: "Start",
  pro: "Pro",
  business: "Business",
};

export function OtherWorkspaces() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<OtherWorkspace | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Fetch other workspaces where user is owner
  const { data: otherWorkspaces, isLoading } = useQuery({
    queryKey: ["other-workspaces", user?.id],
    queryFn: async () => {
      if (!user?.id || !profile?.workspace_id) return [];

      // Get workspaces where user is owner (excluding current)
      const { data: workspaces, error: workspacesError } = await supabase
        .from("workspaces")
        .select("id, name, created_at")
        .eq("owner_id", user.id)
        .neq("id", profile.workspace_id);

      if (workspacesError) throw workspacesError;
      if (!workspaces || workspaces.length === 0) return [];

      // For each workspace, get subscription info and counts
      const enrichedWorkspaces: OtherWorkspace[] = await Promise.all(
        workspaces.map(async (ws) => {
          // Get subscription
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status, plan_type")
            .eq("workspace_id", ws.id)
            .single();

          // Get leads count
          const { count: leadsCount } = await supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ws.id);

          // Get messages count
          const { count: messagesCount } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", ws.id);

          return {
            id: ws.id,
            name: ws.name,
            created_at: ws.created_at,
            subscription_status: subscription?.status || "unknown",
            plan_type: subscription?.plan_type || "trial",
            leads_count: leadsCount || 0,
            messages_count: messagesCount || 0,
          };
        })
      );

      return enrichedWorkspaces;
    },
    enabled: !!user?.id && !!profile?.workspace_id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-workspace", {
        body: { workspace_id: workspaceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Workspace excluído com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["other-workspaces"] });
      setWorkspaceToDelete(null);
      setConfirmText("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao excluir workspace");
    },
  });

  const handleDeleteClick = (workspace: OtherWorkspace) => {
    setWorkspaceToDelete(workspace);
    setConfirmText("");
  };

  const handleConfirmDelete = () => {
    if (workspaceToDelete && confirmText === "EXCLUIR") {
      deleteMutation.mutate(workspaceToDelete.id);
    }
  };

  // Don't render if no other workspaces
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Outros Workspaces</h2>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (!otherWorkspaces || otherWorkspaces.length === 0) {
    return null; // Don't show section if no other workspaces
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Outros Workspaces</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Você é proprietário de outros workspaces que não está usando atualmente:
        </p>

        <div className="space-y-3">
          {otherWorkspaces.map((workspace) => {
            const statusInfo = STATUS_LABELS[workspace.subscription_status] || { 
              label: workspace.subscription_status, 
              variant: "outline" as const 
            };

            return (
              <div
                key={workspace.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{workspace.name}</span>
                    <Badge variant={statusInfo.variant} className="text-xs">
                      {statusInfo.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {PLAN_NAMES[workspace.plan_type] || workspace.plan_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {workspace.leads_count} lead{workspace.leads_count !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {workspace.messages_count} mensagen{workspace.messages_count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteClick(workspace)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!workspaceToDelete} onOpenChange={() => setWorkspaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Workspace
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a excluir permanentemente o workspace{" "}
                <strong>"{workspaceToDelete?.name}"</strong>.
              </p>
              
              {workspaceToDelete && (workspaceToDelete.leads_count > 0 || workspaceToDelete.messages_count > 0) && (
                <div className="p-3 bg-destructive/10 rounded-md text-destructive text-sm">
                  <p className="font-medium">⚠️ Este workspace contém dados:</p>
                  <ul className="list-disc list-inside mt-1">
                    {workspaceToDelete.leads_count > 0 && (
                      <li>{workspaceToDelete.leads_count} lead(s)</li>
                    )}
                    {workspaceToDelete.messages_count > 0 && (
                      <li>{workspaceToDelete.messages_count} mensagem(ns)</li>
                    )}
                  </ul>
                </div>
              )}

              <p className="text-sm">
                Esta ação é <strong>irreversível</strong>. Todos os dados, leads, mensagens, 
                agendamentos e configurações serão permanentemente excluídos.
              </p>

              <div className="pt-2">
                <p className="text-sm mb-2">
                  Digite <strong>EXCLUIR</strong> para confirmar:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="EXCLUIR"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={confirmText !== "EXCLUIR" || deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir Permanentemente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
