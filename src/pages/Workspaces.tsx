import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserWorkspaces, type UserWorkspace } from "@/hooks/useUserWorkspaces";
import { WORKSPACE_TEMPLATE_LIST, getWorkspaceTemplate } from "@/lib/workspaceTemplates";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import {
    Building2,
    Plus,
    Check,
    ArrowRight,
    Trash2,
    Crown,
    Shield,
    User,
    MessageSquare,
    Contact,
    Users,
    Loader2,
} from "lucide-react";



// ─── Helpers ───────────────────────────────────────────────────
function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
    owner: "Proprietário",
    admin: "Administrador",
    member: "Membro",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
    owner: <Crown className="h-3.5 w-3.5" />,
    admin: <Shield className="h-3.5 w-3.5" />,
    member: <User className="h-3.5 w-3.5" />,
};

// ─── Page Component ────────────────────────────────────────────
const Workspaces = () => {
    const { user, profile, refreshProfile } = useAuth();
    const { workspaces, activeWorkspace, isLoading, switchWorkspace, isSwitching } = useUserWorkspaces();
    const queryClient = useQueryClient();

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [customName, setCustomName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<UserWorkspace | null>(null);

    const selectedTemplate = selectedTemplateId ? getWorkspaceTemplate(selectedTemplateId) : null;

    // ─── Workspace Stats ──────────────────────────────────────
    const { data: stats } = useQuery({
        queryKey: ["workspace-stats", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return null;
            const wsId = profile.workspace_id;

            const [leadsRes, msgsRes, membersRes] = await Promise.all([
                supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
                supabase.from("messages").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
                supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", wsId),
            ]);

            return {
                leads: leadsRes.count || 0,
                messages: msgsRes.count || 0,
                members: membersRes.count || 0,
            };
        },
        enabled: !!profile?.workspace_id,
    });

    // ─── Create Workspace ─────────────────────────────────────
    const createWorkspaceMutation = useMutation({
        mutationFn: async ({ name, template }: { name: string; template: string }) => {
            if (!user?.id) throw new Error("Usuário não autenticado");

            // 1. Create workspace
            const { data: workspace, error: wsError } = await supabase
                .from("workspaces")
                .insert({ name, owner_id: user.id, settings: { template } })
                .select("id")
                .single();

            if (wsError) throw new Error(`Erro ao criar workspace: ${wsError.message}`);

            // 2. Add user as owner
            const { error: memberError } = await supabase
                .from("workspace_members")
                .insert({
                    workspace_id: workspace.id,
                    user_id: user.id,
                    role: "owner",
                });

            if (memberError) {
                // Rollback workspace
                await supabase.from("workspaces").delete().eq("id", workspace.id);
                throw new Error(`Erro ao configurar permissões: ${memberError.message}`);
            }

            // 3. Create workspace profile
            await supabase
                .from("workspace_profiles" as any)
                .insert({
                    workspace_id: workspace.id,
                    name,
                    description: `Workspace de ${template}`,
                } as any);

            // 4. Create trial subscription
            await supabase
                .from("subscriptions")
                .insert({
                    workspace_id: workspace.id,
                    plan_type: "trial",
                    status: "active",
                    trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                });

            return workspace;
        },
        onSuccess: (workspace) => {
            toast.success("Workspace criado com sucesso! 🎉");
            setShowCreateDialog(false);
            setSelectedTemplateId(null);
            setCustomName("");
            queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    // ─── Delete Workspace ─────────────────────────────────────
    const deleteWorkspaceMutation = useMutation({
        mutationFn: async (workspaceId: string) => {
            if (!user?.id) throw new Error("Usuário não autenticado");

            // Can't delete active workspace
            if (profile?.workspace_id === workspaceId) {
                throw new Error("Não é possível excluir o workspace ativo. Troque de workspace primeiro.");
            }

            // Delete related data in order (FK constraints)
            const tables = [
                "workspace_profiles",
                "workspace_members",
                "subscriptions",
            ];

            for (const table of tables) {
                const { error } = await supabase
                    .from(table as any)
                    .delete()
                    .eq("workspace_id", workspaceId);
                if (error) {
                    console.warn(`[delete-ws] Error deleting from ${table}:`, error.message);
                    // Continue — some tables may not have data
                }
            }

            // Delete the workspace itself
            const { error: wsError } = await supabase
                .from("workspaces")
                .delete()
                .eq("id", workspaceId);

            if (wsError) throw new Error(`Erro ao excluir workspace: ${wsError.message}`);
        },
        onSuccess: () => {
            toast.success("Workspace excluído com sucesso");
            setDeleteTarget(null);
            queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao excluir workspace");
        },
    });

    // ─── Create Handler ───────────────────────────────────────
    const handleCreateWorkspace = (templateId: string) => {
        setSelectedTemplateId(templateId);
        setShowCreateDialog(true);
        if (templateId !== "custom") {
            const tpl = getWorkspaceTemplate(templateId);
            setCustomName(tpl.name);
        } else {
            setCustomName("");
        }
    };

    const confirmCreate = () => {
        const name = customName.trim();
        if (!name) {
            toast.error("Digite um nome para o workspace");
            return;
        }
        createWorkspaceMutation.mutate({
            name,
            template: selectedTemplateId || "custom",
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Building2 className="h-7 w-7 text-primary" />
                    Workspaces
                </h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie seus workspaces, crie novos a partir de templates e organize sua equipe.
                </p>
            </div>

            {/* Active Workspace */}
            {activeWorkspace && (
                <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            <Check className="h-3.5 w-3.5 text-primary" />
                            Workspace Ativo
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <Avatar className={`h-14 w-14 rounded-xl border-2 ${(() => getWorkspaceTemplate(activeWorkspace.template))().borderColor}`}>
                                <AvatarImage src={activeWorkspace.avatar_url || undefined} className="rounded-xl" />
                                <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold rounded-xl">
                                    {getInitials(activeWorkspace.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-semibold truncate">{activeWorkspace.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs gap-1">
                                        {ROLE_ICONS[activeWorkspace.role]}
                                        {ROLE_LABELS[activeWorkspace.role]}
                                    </Badge>
                                    {activeWorkspace.template && (() => {
                                        const tpl = getWorkspaceTemplate(activeWorkspace.template);
                                        const Icon = tpl.icon;
                                        return (
                                            <Badge variant="secondary" className={`text-xs gap-1 ${tpl.color}`}>
                                                <Icon className="h-3 w-3" />
                                                {tpl.name}
                                            </Badge>
                                        );
                                    })()}
                                </div>
                            </div>
                            {stats && (
                                <div className="flex gap-6 text-center">
                                    <div>
                                        <p className="text-2xl font-bold">{stats.leads}</p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <Contact className="h-3 w-3" /> Leads
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.messages}</p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" /> Mensagens
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{stats.members}</p>
                                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                            <Users className="h-3 w-3" /> Membros
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* My Workspaces */}
            {workspaces.length > 1 && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Meus Workspaces</h3>
                    <div className="grid gap-3">
                        {workspaces
                            .filter((ws) => ws.id !== activeWorkspace?.id)
                            .map((ws) => (
                                <Card key={ws.id} className="hover:border-muted-foreground/30 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            {(() => {
                                                const tpl = getWorkspaceTemplate(ws.template);
                                                const Icon = tpl.icon;
                                                return ws.avatar_url ? (
                                                    <Avatar className={`h-10 w-10 rounded-xl border-2 ${tpl.borderColor}`}>
                                                        <AvatarImage src={ws.avatar_url} className="rounded-xl" />
                                                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-bold rounded-xl">
                                                            {getInitials(ws.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <div className={`h-10 w-10 rounded-xl border-2 ${tpl.bgColor} ${tpl.color} ${tpl.borderColor} flex items-center justify-center shrink-0`}>
                                                        <Icon className="h-5 w-5" />
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{ws.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {ROLE_LABELS[ws.role]}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => switchWorkspace(ws.id)}
                                                    disabled={isSwitching}
                                                    className="gap-1.5"
                                                >
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                    Trocar
                                                </Button>
                                                {ws.role === "owner" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9"
                                                        onClick={() => setDeleteTarget(ws)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                </div>
            )}

            {/* Create New Workspace */}
            <div>
                <h3 className="text-lg font-semibold mb-2">Criar Novo Workspace</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Escolha um template para começar rapidamente ou crie um personalizado.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {WORKSPACE_TEMPLATE_LIST.map((template) => {
                        const Icon = template.icon;
                        return (
                            <Card
                                key={template.id}
                                className="cursor-pointer transition-all hover:shadow-md hover:border-muted-foreground/40 hover:scale-[1.02] group"
                                onClick={() => handleCreateWorkspace(template.id)}
                            >
                                <CardContent className="p-4 text-center">
                                    <div
                                        className={`${template.bgColor} ${template.color} w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110`}
                                    >
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <h4 className="font-semibold text-sm">{template.name}</h4>
                                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                                        {template.description}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            {selectedTemplate && (() => {
                                const Icon = selectedTemplate.icon;
                                return (
                                    <div className={`${selectedTemplate.bgColor} ${selectedTemplate.color} w-10 h-10 rounded-xl flex items-center justify-center`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                );
                            })()}
                            Criar Workspace
                        </DialogTitle>
                        <DialogDescription>
                            {selectedTemplateId === "custom"
                                ? "Crie um workspace personalizado do zero."
                                : `Template: ${selectedTemplate?.name}. Você pode personalizar o nome.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="workspace-name">Nome do Workspace</Label>
                            <Input
                                id="workspace-name"
                                placeholder="Ex: Marketing Digital"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCreateDialog(false);
                                setSelectedTemplateId(null);
                                setCustomName("");
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmCreate}
                            disabled={!customName.trim() || createWorkspaceMutation.isPending}
                        >
                            {createWorkspaceMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Criando...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Criar Workspace
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Workspace</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
                            Todos os dados, leads, conversas e configurações serão permanentemente removidos.
                            Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteTarget) deleteWorkspaceMutation.mutate(deleteTarget.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteWorkspaceMutation.isPending ? (
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
        </div>
    );
};

export default Workspaces;

