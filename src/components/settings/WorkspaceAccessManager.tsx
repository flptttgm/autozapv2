import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { Crown, Shield, User, Users, ArrowRightLeft, Trash2, Loader2 } from "lucide-react";

const getRoleIcon = (role: string) => {
    switch (role) {
        case "owner": return <Crown className="h-4 w-4" />;
        case "admin": return <Shield className="h-4 w-4" />;
        default: return <User className="h-4 w-4" />;
    }
};

const getRoleLabel = (role: string) => {
    switch (role) {
        case "owner": return "Proprietário";
        case "admin": return "Administrador";
        default: return "Membro";
    }
};

export function WorkspaceAccessManager() {
    const { user, profile } = useAuth();
    const { canManageTeam, isOwner } = useWorkspaceRole();
    const queryClient = useQueryClient();
    const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

    const workspaceId = profile?.workspace_id;

    // Fetch members of the current workspace
    const { data: members, isLoading } = useQuery({
        queryKey: ["workspace-access-members", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];
            const { data, error } = await supabase
                .from("workspace_members")
                .select("id, role, user_id, created_at, profiles:user_id(full_name)")
                .eq("workspace_id", workspaceId)
                .order("created_at", { ascending: true });

            if (error) throw error;
            return data || [];
        },
        enabled: !!workspaceId && canManageTeam,
    });

    // Update role mutation
    const updateRoleMutation = useMutation({
        mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: string }) => {
            const { error } = await supabase
                .from("workspace_members")
                .update({ role: newRole })
                .eq("id", memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Permissão atualizada!");
            queryClient.invalidateQueries({ queryKey: ["workspace-access-members", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["team-members"] });
        },
        onError: () => {
            toast.error("Erro ao atualizar permissão");
        },
    });

    // Remove member mutation
    const removeMemberMutation = useMutation({
        mutationFn: async (memberId: string) => {
            const { error } = await supabase
                .from("workspace_members")
                .delete()
                .eq("id", memberId);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Membro removido do workspace");
            setConfirmRemove(null);
            queryClient.invalidateQueries({ queryKey: ["workspace-access-members", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["team-members"] });
            queryClient.invalidateQueries({ queryKey: ["members-used"] });
        },
        onError: () => {
            toast.error("Erro ao remover membro");
        },
    });

    // Only show for admins/owners
    if (!canManageTeam) return null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <ArrowRightLeft className="h-5 w-5" />
                        Gerenciar Permissões do Workspace
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Controle quem pode acessar este workspace e seus níveis de permissão.
                    </p>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : !members || members.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum membro encontrado
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {members.map((member: any) => {
                                const isCurrentUser = member.user_id === user?.id;
                                const memberName = member.profiles?.full_name || "Sem nome";
                                const isOwnerRole = member.role === "owner";

                                return (
                                    <div
                                        key={member.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                {getRoleIcon(member.role)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium truncate">{memberName}</p>
                                                    {isCurrentUser && (
                                                        <Badge variant="outline" className="text-[10px] shrink-0">
                                                            Você
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {getRoleLabel(member.role)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions: only owners can change other roles, and you can't change your own or owners */}
                                        {!isOwnerRole && !isCurrentUser && isOwner && (
                                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                                <Select
                                                    value={member.role}
                                                    onValueChange={(newRole) =>
                                                        updateRoleMutation.mutate({
                                                            memberId: member.id,
                                                            newRole,
                                                        })
                                                    }
                                                    disabled={updateRoleMutation.isPending}
                                                >
                                                    <SelectTrigger className="w-36 h-9">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="admin">Administrador</SelectItem>
                                                        <SelectItem value="member">Membro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() =>
                                                        setConfirmRemove({ id: member.id, name: memberName })
                                                    }
                                                    disabled={removeMemberMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}

                                        {/* Admins can remove members but not change roles to admin */}
                                        {!isOwnerRole && !isCurrentUser && canManageTeam && !isOwner && member.role === "member" && (
                                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() =>
                                                        setConfirmRemove({ id: member.id, name: memberName })
                                                    }
                                                    disabled={removeMemberMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation dialog */}
            <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Membro</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover <strong>{confirmRemove?.name}</strong> deste workspace?
                            Essa pessoa perderá acesso a todos os dados do workspace.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (confirmRemove) removeMemberMutation.mutate(confirmRemove.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {removeMemberMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removendo...
                                </>
                            ) : (
                                "Remover"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
