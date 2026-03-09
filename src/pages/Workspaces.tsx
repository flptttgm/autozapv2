import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserWorkspaces, type UserWorkspace } from "@/hooks/useUserWorkspaces";
import { usePresenceContext } from "@/hooks/useWorkspacePresence";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useSubscription } from "@/hooks/useSubscription";
import { WORKSPACE_TEMPLATE_LIST, getWorkspaceTemplate } from "@/lib/workspaceTemplates";
import { SidebarPagesVisibility } from "@/components/settings/SidebarPagesVisibility";
import { MemberAccessDialog } from "@/components/settings/MemberAccessDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    DialogClose,
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
    Lock,
    Clock,
    CalendarDays,
    FolderKey,
    ChevronsUpDown,
    ChevronDown,
    LayoutDashboard,
    Bot,
    Calendar,
    FileText,
    Receipt,
    Cast,
    Settings,
    Sparkles,
    MoreHorizontal,
    UserPlus,
    AlertTriangle,
    UserMinus,
    Mail,
    Send,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";

const inviteSchema = z.object({
    email: z.string().trim().email("Email inválido"),
    role: z.enum(["admin", "member"]),
});



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

const roleBadgeStyles: Record<string, string> = {
    owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    admin: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
    member: "bg-muted text-muted-foreground border-border/50",
};

const avatarColors = [
    "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    "bg-pink-500/15 text-pink-600 dark:text-pink-400",
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getLastSeenText(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return "Ontem";
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

function getMemberSince(dateStr: string) {
    const date = new Date(dateStr);
    const months = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];
    return `Desde ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Page Component ────────────────────────────────────────────
const Workspaces = () => {
    const { user, profile, refreshProfile } = useAuth();
    const { workspaces, activeWorkspace, isLoading, switchWorkspace, isSwitching } = useUserWorkspaces();
    const { onlineUserIds } = usePresenceContext();
    const { canManageTeam, isOwner } = useWorkspaceRole();
    const { membersUsed, membersLimit, canAddMember } = useSubscription();
    const queryClient = useQueryClient();

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [customName, setCustomName] = useState("");
    const [selectedIcon, setSelectedIcon] = useState<string>("custom");
    const [selectedPages, setSelectedPages] = useState<string[]>(["settings"]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [deleteTarget, setDeleteTarget] = useState<UserWorkspace | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");
    const [addMemberTarget, setAddMemberTarget] = useState<UserWorkspace | null>(null);
    const [addMemberSelection, setAddMemberSelection] = useState<string[]>([]);
    const [accessMember, setAccessMember] = useState<{ id: string; name: string; role: string } | null>(null);
    const [removeMemberTarget, setRemoveMemberTarget] = useState<{ userId: string; name: string } | null>(null);
    const [removeMemberConfirmText, setRemoveMemberConfirmText] = useState("");
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

    // Icon options from templates (excluding 'custom' since it's the default)
    const ICON_OPTIONS = WORKSPACE_TEMPLATE_LIST.map(tpl => ({
        id: tpl.id,
        name: tpl.name,
        icon: tpl.icon,
        color: tpl.color,
        bgColor: tpl.bgColor,
        borderColor: tpl.borderColor,
    }));

    // Available pages for custom workspace (excluding Workspaces)
    const AVAILABLE_PAGES = [
        { id: "dashboard", label: "Dashboard", description: "Painel principal com métricas", icon: LayoutDashboard },
        { id: "agents", label: "Agentes IA", description: "Gerencie agentes de atendimento", icon: Bot },
        { id: "leads", label: "Leads", description: "Base de contatos e clientes", icon: Contact },
        { id: "conversations", label: "Conversas", description: "Histórico de mensagens", icon: MessageSquare },
        { id: "appointments", label: "Agendamentos", description: "Compromissos e horários", icon: Calendar },
        { id: "quotes", label: "Orçamentos", description: "Propostas comerciais da IA", icon: FileText },
        { id: "invoices", label: "Cobranças", description: "Faturas e pagamentos", icon: Receipt },
        { id: "whatsapp", label: "Conexões WhatsApp", description: "Instâncias e integrações", icon: Cast },
        { id: "settings", label: "Configurações", description: "Ajustes gerais do workspace", icon: Settings, required: true },
    ];

    const togglePage = (pageId: string) => {
        const page = AVAILABLE_PAGES.find(p => p.id === pageId);
        if (page?.required) return; // Can't toggle required pages
        setSelectedPages(prev =>
            prev.includes(pageId)
                ? prev.filter(id => id !== pageId)
                : [...prev, pageId]
        );
    };

    const toggleMember = (userId: string) => {
        setSelectedMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

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

    // ─── Team Members ─────────────────────────────────────────
    const { data: members } = useQuery({
        queryKey: ["workspace-team-members", profile?.workspace_id],
        queryFn: async () => {
            if (!profile?.workspace_id) return [];
            const { data: memberRows, error } = await supabase
                .from("workspace_members")
                .select("*")
                .eq("workspace_id", profile.workspace_id)
                .order("created_at", { ascending: true });

            if (error) throw error;
            if (!memberRows || memberRows.length === 0) return [];

            const userIds = memberRows.map((m: any) => m.user_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, display_name, last_seen_at, avatar_url")
                .in("user_id", userIds);

            const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

            return memberRows.map((m: any) => ({
                ...m,
                profile: profileMap.get(m.user_id) || null,
            }));
        },
        enabled: !!profile?.workspace_id,
    });

    // ─── Create Workspace ─────────────────────────────────────
    const createWorkspaceMutation = useMutation({
        mutationFn: async ({ name, iconId, pages, memberIds }: { name: string; iconId: string; pages: string[]; memberIds: string[] }) => {
            if (!user?.id) throw new Error("Usuário não autenticado");

            // 1. Create workspace
            const { data: workspace, error: wsError } = await supabase
                .from("workspaces")
                .insert({ name, owner_id: user.id, settings: { template: "custom", customIcon: iconId } })
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
                await supabase.from("workspaces").delete().eq("id", workspace.id);
                throw new Error(`Erro ao configurar permissões: ${memberError.message}`);
            }

            // 3. Create workspace profile
            await supabase
                .from("workspace_profiles" as any)
                .insert({
                    workspace_id: workspace.id,
                    name,
                    description: "Workspace personalizado",
                } as any);

            // 4. Save selected pages as sidebar visibility config
            const visibilityConfig: Record<string, boolean> = {
                appointments: pages.includes("appointments"),
                quotes: pages.includes("quotes"),
                invoices: pages.includes("invoices"),
            };

            // Save extended pages config (for custom workspaces)
            const customPagesConfig: Record<string, boolean> = {};
            AVAILABLE_PAGES.forEach(p => {
                customPagesConfig[p.id] = pages.includes(p.id);
            });

            await supabase
                .from("system_config")
                .insert({
                    workspace_id: workspace.id,
                    config_key: "sidebar_pages_visibility",
                    config_value: visibilityConfig as any,
                });

            await supabase
                .from("system_config")
                .insert({
                    workspace_id: workspace.id,
                    config_key: "custom_workspace_pages",
                    config_value: customPagesConfig as any,
                });

            // 5. Invite selected members
            if (memberIds.length > 0) {
                const memberInserts = memberIds.map(uid => ({
                    workspace_id: workspace.id,
                    user_id: uid,
                    role: "member" as const,
                }));

                const { error: inviteError } = await supabase
                    .from("workspace_members")
                    .insert(memberInserts);

                if (inviteError) {
                    console.warn("[create-ws] Error inviting members:", inviteError.message);
                }
            }

            return workspace;
        },
        onSuccess: () => {
            toast.success("Workspace criado com sucesso! 🎉");
            setShowCreateDialog(false);
            setCustomName("");
            setSelectedIcon("custom");
            setSelectedPages(["settings"]);
            setSelectedMembers([]);
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
            setDeleteConfirmText("");
            queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao excluir workspace");
        },
    });

    // ─── Remove Member from All Workspaces ───────────────────
    const removeMemberMutation = useMutation({
        mutationFn: async (userId: string) => {
            if (!user?.id) throw new Error("Usuário não autenticado");

            // Get all workspace_members entries for this user across all workspaces owned by current user
            const { data: memberEntries } = await supabase
                .from("workspace_members")
                .select("id, workspace_id")
                .eq("user_id", userId);

            if (memberEntries && memberEntries.length > 0) {
                const memberIds = memberEntries.map((m: any) => m.id);

                // Delete folder access for all member entries
                for (const memberId of memberIds) {
                    await supabase
                        .from("member_folder_access" as any)
                        .delete()
                        .eq("member_id", memberId);
                }

                // Delete all workspace_members entries for this user
                await supabase
                    .from("workspace_members")
                    .delete()
                    .eq("user_id", userId);
            }
        },
        onSuccess: () => {
            toast.success("Membro removido com sucesso");
            setRemoveMemberTarget(null);
            queryClient.invalidateQueries({ queryKey: ["workspace-team-members"] });
            queryClient.invalidateQueries({ queryKey: ["all-account-members"] });
            queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
        },
        onError: (error: Error) => {
            toast.error(error.message || "Erro ao remover membro");
        },
    });

    // ─── Send Invite ─────────────────────────────────────────
    const sendInviteMutation = useMutation({
        mutationFn: async () => {
            const validated = inviteSchema.parse({ email: inviteEmail, role: inviteRole });
            const { data, error } = await supabase.functions.invoke("send-invite", {
                body: { email: validated.email, role: validated.role },
            });
            if (error) {
                const context = (error as any)?.context;
                if (context && typeof context.json === 'function') {
                    try {
                        const body = await context.json();
                        if (body?.error) throw new Error(body.error);
                    } catch (_) { }
                }
                throw error;
            }
            if (data?.error) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            toast.success("Convite enviado por email!");
            setInviteEmail("");
            setInviteRole("member");
            setInviteDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["members-used"] });
            queryClient.invalidateQueries({ queryKey: ["workspace-team-members"] });
            queryClient.invalidateQueries({ queryKey: ["all-account-members"] });
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
        },
    });

    // ─── Add Members to Workspace ────────────────────────────
    const { data: targetWsMembers } = useQuery({
        queryKey: ["target-ws-members", addMemberTarget?.id],
        queryFn: async () => {
            if (!addMemberTarget?.id) return [];
            const { data } = await supabase
                .from("workspace_members")
                .select("user_id")
                .eq("workspace_id", addMemberTarget.id);
            return (data || []).map((m: any) => m.user_id);
        },
        enabled: !!addMemberTarget?.id,
    });

    const addMembersMutation = useMutation({
        mutationFn: async ({ workspaceId, userIds }: { workspaceId: string; userIds: string[] }) => {
            const inserts = userIds.map(uid => ({
                workspace_id: workspaceId,
                user_id: uid,
                role: "member" as const,
            }));

            const { error } = await supabase
                .from("workspace_members")
                .insert(inserts);

            if (error) throw new Error(`Erro ao adicionar membros: ${error.message}`);
        },
        onSuccess: () => {
            toast.success("Membros adicionados com sucesso! 🎉");
            setAddMemberTarget(null);
            setAddMemberSelection([]);
            queryClient.invalidateQueries({ queryKey: ["user-workspaces"] });
            queryClient.invalidateQueries({ queryKey: ["target-ws-members"] });
            queryClient.invalidateQueries({ queryKey: ["all-account-members"] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        },
    });

    // ─── Create Handler ───────────────────────────────────────
    const handleOpenCreateDialog = () => {
        setShowCreateDialog(true);
        setCustomName("");
        setSelectedIcon("custom");
        setSelectedPages(["settings"]);
        setSelectedMembers([]);
    };

    const confirmCreate = () => {
        const name = customName.trim();
        if (!name) {
            toast.error("Digite um nome para o workspace");
            return;
        }
        createWorkspaceMutation.mutate({
            name,
            iconId: selectedIcon,
            pages: selectedPages,
            memberIds: selectedMembers,
        });
    };

    // ─── All Members across all owned workspaces (for creation form) ─
    const { data: allAccountMembers } = useQuery({
        queryKey: ["all-account-members", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];

            // 1. Get all workspaces owned by this user
            const { data: ownedWorkspaces } = await supabase
                .from("workspaces")
                .select("id")
                .eq("owner_id", user.id);

            if (!ownedWorkspaces || ownedWorkspaces.length === 0) return [];

            const wsIds = ownedWorkspaces.map((ws: any) => ws.id);

            // 2. Get all members from all owned workspaces
            const { data: memberRows, error } = await supabase
                .from("workspace_members")
                .select("*")
                .in("workspace_id", wsIds);

            if (error) throw error;
            if (!memberRows || memberRows.length === 0) return [];

            // 3. Deduplicate by user_id (keep first occurrence)
            const seen = new Set<string>();
            const uniqueMembers = memberRows.filter((m: any) => {
                if (seen.has(m.user_id)) return false;
                seen.add(m.user_id);
                return true;
            });

            // 4. Get profiles
            const userIds = uniqueMembers.map((m: any) => m.user_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("user_id, display_name, last_seen_at, avatar_url")
                .in("user_id", userIds);

            const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

            return uniqueMembers.map((m: any) => ({
                ...m,
                profile: profileMap.get(m.user_id) || null,
            }));
        },
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
    });

    // Other members (exclude current user)
    const otherMembers = (allAccountMembers || []).filter((m: any) => m.user_id !== user?.id);

    // Members available to add to a target workspace (exclude self + already in target)
    const availableToAdd = (allAccountMembers || []).filter((m: any) =>
        m.user_id !== user?.id && !(targetWsMembers || []).includes(m.user_id)
    );

    // ─── Online count ─────────────────────────────────────────
    const onlineCount = members?.filter((m: any) => onlineUserIds.has(m.user_id)).length || 0;

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
            <div className="pt-6">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Building2 className="h-7 w-7 text-primary" />
                    Workspaces
                </h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie seus workspaces, equipe e personalize as páginas visíveis.
                </p>
            </div>

            {/* Active Workspace + Switcher */}
            {activeWorkspace && (
                <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                            <Check className="h-3.5 w-3.5 text-primary" />
                            Workspace Ativo
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            {(() => {
                                const tpl = getWorkspaceTemplate(
                                    (activeWorkspace.template === "custom" && activeWorkspace.customIcon) ? activeWorkspace.customIcon : activeWorkspace.template
                                );
                                const TplIcon = tpl.icon;
                                return activeWorkspace.avatar_url ? (
                                    <Avatar className={`h-14 w-14 rounded-xl border-2 ${tpl.borderColor}`}>
                                        <AvatarImage src={activeWorkspace.avatar_url} className="rounded-xl" />
                                        <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold rounded-xl">
                                            {getInitials(activeWorkspace.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <div className={`h-14 w-14 rounded-xl border-2 ${tpl.bgColor} ${tpl.color} ${tpl.borderColor} flex items-center justify-center shrink-0`}>
                                        <TplIcon className="h-7 w-7" />
                                    </div>
                                );
                            })()}
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

                        {/* Inline workspace switcher */}
                        {workspaces.length > 1 && (
                            <>
                                <div className="h-px bg-border/50" />
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-2.5 flex items-center gap-1.5">
                                        <ChevronsUpDown className="h-3 w-3" />
                                        Alternar workspace
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {workspaces.map((ws) => {
                                            const tpl = getWorkspaceTemplate(
                                                (ws.template === "custom" && ws.customIcon) ? ws.customIcon : ws.template
                                            );
                                            const Icon = tpl.icon;
                                            const isActive = ws.id === activeWorkspace.id;
                                            return (
                                                <button
                                                    key={ws.id}
                                                    onClick={() => !isActive && switchWorkspace(ws.id, "/workspaces")}
                                                    disabled={isSwitching || isActive}
                                                    className={cn(
                                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all group",
                                                        isActive
                                                            ? `${tpl.borderColor} ${tpl.bgColor} cursor-default`
                                                            : "border-border/60 bg-card/60 hover:bg-muted/60 hover:border-primary/30 disabled:opacity-50 disabled:pointer-events-none"
                                                    )}
                                                >
                                                    {ws.avatar_url ? (
                                                        <Avatar className={`h-7 w-7 rounded-lg border ${tpl.borderColor}`}>
                                                            <AvatarImage src={ws.avatar_url} className="rounded-lg" />
                                                            <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-bold rounded-lg">
                                                                {getInitials(ws.name)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ) : (
                                                        <div className={`h-7 w-7 rounded-lg ${tpl.bgColor} ${tpl.color} flex items-center justify-center shrink-0`}>
                                                            <Icon className="h-3.5 w-3.5" />
                                                        </div>
                                                    )}
                                                    <div className="text-left">
                                                        <p className={cn(
                                                            "text-sm font-medium leading-tight transition-colors",
                                                            isActive ? tpl.color : "group-hover:text-foreground"
                                                        )}>{ws.name}</p>
                                                        <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[ws.role]}</p>
                                                    </div>
                                                    {isActive && (
                                                        <Check className={`h-3.5 w-3.5 ${tpl.color} ml-1`} />
                                                    )}
                                                    {!isActive && ws.template && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground rounded-md p-0.5 hover:bg-muted"
                                                                >
                                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAddMemberTarget(ws);
                                                                        setAddMemberSelection([]);
                                                                    }}
                                                                    className="gap-2 cursor-pointer"
                                                                >
                                                                    <UserPlus className="h-4 w-4" />
                                                                    Adicionar membro
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeleteTarget(ws);
                                                                    }}
                                                                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    Excluir workspace
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ─── Team Members Section ─── */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2.5 text-lg">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-primary" />
                                </div>
                                Equipe
                            </CardTitle>
                            <CardDescription className="flex items-center gap-3 text-sm">
                                <span className="inline-flex items-center gap-1.5">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                    {onlineCount} online
                                </span>
                                <span className="text-muted-foreground/60">
                                    • {membersUsed}/{membersLimit} membros ativos
                                </span>
                            </CardDescription>
                        </div>
                        {canManageTeam && (
                            <Button
                                onClick={() => {
                                    setInviteEmail("");
                                    setInviteRole("member");
                                    setInviteDialogOpen(true);
                                }}
                                disabled={!canAddMember}
                                className="gap-2 shadow-sm"
                                size="sm"
                            >
                                <UserPlus className="h-4 w-4" />
                                Convidar
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="space-y-2">
                        {members?.map((member: any) => {
                            const memberName = member.profile?.display_name || "Sem nome";
                            const initials = getInitials(memberName);
                            const colorClass = getAvatarColor(memberName);
                            const isCurrentUser = member.user_id === user?.id;
                            const isOnline = onlineUserIds.has(member.user_id);
                            const canManageAccess = canManageTeam && member.role === "member" && !isCurrentUser;

                            return (
                                <div
                                    key={member.id}
                                    className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all duration-200"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {/* Avatar with photo/initials + online indicator */}
                                        <div className="relative">
                                            <Avatar className="h-10 w-10">
                                                {member.profile?.avatar_url && (
                                                    <AvatarImage src={member.profile.avatar_url} alt={memberName} />
                                                )}
                                                <AvatarFallback className={`font-semibold text-sm ${colorClass}`}>
                                                    {initials || <User className="h-4 w-4" />}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div
                                                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${isOnline
                                                    ? "bg-emerald-500"
                                                    : "bg-muted-foreground/30"
                                                    }`}
                                                title={isOnline ? "Online" : member.profile?.last_seen_at ? `Visto ${getLastSeenText(member.profile.last_seen_at)}` : "Offline"}
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm truncate">{memberName}</p>
                                                {isCurrentUser && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                                        Você
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] px-1.5 py-0 gap-1 ${roleBadgeStyles[member.role] || roleBadgeStyles.member}`}
                                                >
                                                    {ROLE_ICONS[member.role]}
                                                    <span>{ROLE_LABELS[member.role] || "Membro"}</span>
                                                </Badge>
                                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                                                    <CalendarDays className="h-3 w-3 inline" />
                                                    {getMemberSince(member.created_at)}
                                                </span>
                                                {isOnline ? (
                                                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Online
                                                    </span>
                                                ) : member.profile?.last_seen_at ? (
                                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                                                        <Clock className="h-3 w-3" />
                                                        {getLastSeenText(member.profile.last_seen_at)}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions: dropdown menu for members */}
                                    {canManageAccess && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    onClick={() => setAccessMember({
                                                        id: member.id,
                                                        name: memberName,
                                                        role: member.role,
                                                    })}
                                                >
                                                    <FolderKey className="h-4 w-4 mr-2" />
                                                    Gerenciar Acessos
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive"
                                                    onClick={() => setRemoveMemberTarget({
                                                        userId: member.user_id,
                                                        name: memberName,
                                                    })}
                                                >
                                                    <UserMinus className="h-4 w-4 mr-2" />
                                                    Remover da equipe
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            );
                        })}

                        {(!members || members.length === 0) && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Nenhum membro na equipe</p>
                                <p className="text-xs mt-1">Convide membros em Configurações → Equipe</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ─── Sidebar Pages Visibility (only for main/custom workspaces) ─── */}
            {(!activeWorkspace?.template || activeWorkspace.template === "custom") && (
                <SidebarPagesVisibility />
            )}

            {/* Create New Workspace */}
            <div className="pb-12">
                <h3 className="text-lg font-semibold mb-2">Criar Novo Workspace</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Crie um workspace personalizado e escolha as páginas e membros.
                </p>
                <Button
                    onClick={handleOpenCreateDialog}
                    className="gap-2"
                    size="lg"
                >
                    <Sparkles className="h-4 w-4" />
                    Criar Workspace Personalizado
                </Button>
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            {(() => {
                                const iconTpl = getWorkspaceTemplate(selectedIcon === "custom" ? null : selectedIcon);
                                const TitleIcon = iconTpl.icon;
                                return (
                                    <div className={`${iconTpl.bgColor} ${iconTpl.color} w-10 h-10 rounded-xl flex items-center justify-center transition-all`}>
                                        <TitleIcon className="h-5 w-5" />
                                    </div>
                                );
                            })()}
                            Criar Workspace Personalizado
                        </DialogTitle>
                        <DialogDescription>
                            Configure seu workspace com as páginas e membros que desejar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                        {/* Step 1: Name */}
                        <div className="space-y-2">
                            <Label htmlFor="workspace-name" className="text-sm font-semibold">Nome do Workspace</Label>
                            <Input
                                id="workspace-name"
                                placeholder="Ex: Suporte ao Cliente"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Step 2: Icon */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold">Ícone do Workspace</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Escolha um ícone para identificar seu workspace.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {ICON_OPTIONS.map((opt) => {
                                    const OptIcon = opt.icon;
                                    const isSelected = selectedIcon === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSelectedIcon(opt.id)}
                                            title={opt.name}
                                            className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center border-2 transition-all",
                                                opt.bgColor, opt.color,
                                                isSelected
                                                    ? `${opt.borderColor} ring-2 ring-offset-2 ring-offset-background ring-current scale-110`
                                                    : "border-transparent hover:scale-105 opacity-70 hover:opacity-100"
                                            )}
                                        >
                                            <OptIcon className="h-5 w-5" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Step 2: Pages */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold">Páginas do Workspace</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">Selecione quais páginas estarão disponíveis na sidebar.</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {AVAILABLE_PAGES.map((page) => {
                                    const isSelected = selectedPages.includes(page.id);
                                    const PageIcon = page.icon;
                                    return (
                                        <button
                                            key={page.id}
                                            type="button"
                                            onClick={() => togglePage(page.id)}
                                            disabled={page.required}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                                isSelected
                                                    ? "border-primary/50 bg-primary/5"
                                                    : "border-border/60 bg-card/40 hover:border-muted-foreground/30 hover:bg-muted/30",
                                                page.required && "opacity-70 cursor-default"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                                                isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                            )}>
                                                <PageIcon className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium leading-tight">{page.label}</p>
                                                <p className="text-[10px] text-muted-foreground leading-tight">{page.description}</p>
                                            </div>
                                            <Checkbox
                                                checked={isSelected}
                                                disabled={page.required}
                                                className="shrink-0"
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Step 3: Members */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold">Adicionar Membros</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Selecione membros do workspace principal para adicionar.
                                </p>
                            </div>
                            {otherMembers.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
                                    <Users className="h-5 w-5 mx-auto mb-1 opacity-50" />
                                    <p className="text-xs">Nenhum membro disponível</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                    {otherMembers.map((m: any) => {
                                        const memberName = m.profile?.display_name || "Sem nome";
                                        const isSelected = selectedMembers.includes(m.user_id);
                                        return (
                                            <button
                                                key={m.user_id}
                                                type="button"
                                                onClick={() => toggleMember(m.user_id)}
                                                className={cn(
                                                    "flex items-center gap-3 w-full p-2.5 rounded-lg border text-left transition-all",
                                                    isSelected
                                                        ? "border-primary/50 bg-primary/5"
                                                        : "border-border/60 bg-card/40 hover:border-muted-foreground/30"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                                    getAvatarColor(memberName)
                                                )}>
                                                    {getInitials(memberName)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{memberName}</p>
                                                    <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[m.role] || "Membro"}</p>
                                                </div>
                                                <Checkbox
                                                    checked={isSelected}
                                                    className="shrink-0"
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowCreateDialog(false);
                                setCustomName("");
                                setSelectedIcon("custom");
                                setSelectedPages(["settings"]);
                                setSelectedMembers([]);
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

            {/* Delete Confirmation — type workspace name to confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
                <AlertDialogContent className="max-w-md">
                    {(() => {
                        const wsName = deleteTarget?.name || "";
                        const wsTpl = deleteTarget ? getWorkspaceTemplate(
                            (deleteTarget.template === "custom" && deleteTarget.customIcon) ? deleteTarget.customIcon : deleteTarget.template
                        ) : null;
                        const WsIcon = wsTpl?.icon || Building2;
                        const isConfirmed = deleteConfirmText.trim().toLowerCase() === wsName.trim().toLowerCase();

                        return (
                            <>
                                <AlertDialogHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={cn("p-2.5 rounded-xl", wsTpl?.bgColor || "bg-destructive/10")}>
                                            <WsIcon className={cn("h-5 w-5", wsTpl?.color || "text-destructive")} />
                                        </div>
                                        <div>
                                            <AlertDialogTitle className="text-left">Excluir Workspace</AlertDialogTitle>
                                            <p className="text-xs text-muted-foreground text-left">{wsName}</p>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                        <AlertDialogDescription className="text-xs text-left leading-relaxed">
                                            Todos os dados, leads, conversas e configurações deste workspace serão permanentemente removidos. Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                    </div>
                                </AlertDialogHeader>

                                <div className="space-y-2 pt-1">
                                    <p className="text-sm text-foreground">
                                        Para confirmar, digite <strong className="text-destructive">{wsName}</strong> abaixo:
                                    </p>
                                    <Input
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        placeholder={wsName}
                                        className={cn(
                                            "h-10 transition-colors",
                                            isConfirmed && "border-destructive focus-visible:ring-destructive/30"
                                        )}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && isConfirmed && deleteTarget) {
                                                deleteWorkspaceMutation.mutate(deleteTarget.id);
                                            }
                                        }}
                                    />
                                </div>

                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancelar</AlertDialogCancel>
                                    <Button
                                        variant="destructive"
                                        disabled={!isConfirmed || deleteWorkspaceMutation.isPending}
                                        onClick={() => deleteTarget && deleteWorkspaceMutation.mutate(deleteTarget.id)}
                                        className="gap-1.5"
                                    >
                                        {deleteWorkspaceMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                        Excluir Permanentemente
                                    </Button>
                                </AlertDialogFooter>
                            </>
                        );
                    })()}
                </AlertDialogContent>
            </AlertDialog>

            {/* Add Member to Workspace Dialog */}
            <Dialog open={!!addMemberTarget} onOpenChange={(open) => { if (!open) { setAddMemberTarget(null); setAddMemberSelection([]); } }}>
                <DialogContent className="max-w-md">
                    {(() => {
                        const wsTpl = addMemberTarget ? getWorkspaceTemplate(
                            (addMemberTarget.template === "custom" && addMemberTarget.customIcon) ? addMemberTarget.customIcon : addMemberTarget.template
                        ) : null;
                        const WsIcon = wsTpl?.icon || Building2;

                        return (
                            <>
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-xl", wsTpl?.bgColor || "bg-primary/10")}>
                                            <WsIcon className={cn("h-5 w-5", wsTpl?.color || "text-primary")} />
                                        </div>
                                        <div>
                                            <span>Adicionar Membros</span>
                                            <p className="text-xs text-muted-foreground font-normal mt-0.5">{addMemberTarget?.name}</p>
                                        </div>
                                    </DialogTitle>
                                    <DialogDescription className="text-sm">
                                        Selecione os membros que deseja adicionar a este workspace.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {availableToAdd.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">Todos os membros já estão neste workspace</p>
                                        </div>
                                    ) : (
                                        availableToAdd.map((m: any) => {
                                            const isSelected = addMemberSelection.includes(m.user_id);
                                            return (
                                                <label
                                                    key={m.user_id}
                                                    className={cn(
                                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                        isSelected
                                                            ? "border-primary/50 bg-primary/5"
                                                            : "border-border/50 hover:border-border hover:bg-muted/30"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => {
                                                            setAddMemberSelection(prev =>
                                                                checked
                                                                    ? [...prev, m.user_id]
                                                                    : prev.filter(id => id !== m.user_id)
                                                            );
                                                        }}
                                                    />
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                                                            {getInitials(m.profile?.display_name || "?")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {m.profile?.display_name || "Sem nome"}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">Membro</p>
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => { setAddMemberTarget(null); setAddMemberSelection([]); }}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        disabled={addMemberSelection.length === 0 || addMembersMutation.isPending}
                                        onClick={() => {
                                            if (addMemberTarget) {
                                                addMembersMutation.mutate({
                                                    workspaceId: addMemberTarget.id,
                                                    userIds: addMemberSelection,
                                                });
                                            }
                                        }}
                                        className="gap-2"
                                    >
                                        {addMembersMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <UserPlus className="h-4 w-4" />
                                        )}
                                        Adicionar {addMemberSelection.length > 0 ? `(${addMemberSelection.length})` : ""}
                                    </Button>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Member Access Dialog */}
            {accessMember && (
                <MemberAccessDialog
                    open={!!accessMember}
                    onOpenChange={(open) => {
                        if (!open) setAccessMember(null);
                    }}
                    member={accessMember}
                />
            )}

            {/* Remove Member Confirmation — type name to confirm */}
            <AlertDialog open={!!removeMemberTarget} onOpenChange={(open) => { if (!open) { setRemoveMemberTarget(null); setRemoveMemberConfirmText(""); } }}>
                <AlertDialogContent className="max-w-md">
                    {(() => {
                        const memberName = removeMemberTarget?.name || "";
                        const isConfirmed = removeMemberConfirmText.trim().toLowerCase() === memberName.trim().toLowerCase();

                        return (
                            <>
                                <AlertDialogHeader>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2.5 rounded-xl bg-destructive/10">
                                            <UserMinus className="h-5 w-5 text-destructive" />
                                        </div>
                                        <div>
                                            <AlertDialogTitle className="text-left">Remover membro</AlertDialogTitle>
                                            <p className="text-xs text-muted-foreground text-left">{memberName}</p>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2.5">
                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                        <AlertDialogDescription className="text-xs text-left leading-relaxed">
                                            O membro perderá acesso a todos os workspaces, pastas e conversas. Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                    </div>
                                </AlertDialogHeader>

                                <div className="space-y-2 pt-1">
                                    <p className="text-sm text-foreground">
                                        Digite <strong className="text-destructive">{memberName}</strong> para confirmar:
                                    </p>
                                    <Input
                                        value={removeMemberConfirmText}
                                        onChange={(e) => setRemoveMemberConfirmText(e.target.value)}
                                        placeholder={memberName}
                                        className={cn(
                                            "h-10 transition-colors",
                                            isConfirmed && "border-destructive focus-visible:ring-destructive/30"
                                        )}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && isConfirmed && removeMemberTarget) {
                                                removeMemberMutation.mutate(removeMemberTarget.userId);
                                            }
                                        }}
                                    />
                                </div>

                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setRemoveMemberConfirmText("")}>Cancelar</AlertDialogCancel>
                                    <Button
                                        variant="destructive"
                                        disabled={!isConfirmed || removeMemberMutation.isPending}
                                        onClick={() => removeMemberTarget && removeMemberMutation.mutate(removeMemberTarget.userId)}
                                        className="gap-1.5"
                                    >
                                        {removeMemberMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <UserMinus className="h-3.5 w-3.5" />
                                        )}
                                        Remover permanentemente
                                    </Button>
                                </AlertDialogFooter>
                            </>
                        );
                    })()}
                </AlertDialogContent>
            </AlertDialog>

            {/* Invite Member Dialog */}
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <UserPlus className="h-4 w-4 text-primary" />
                            </div>
                            Convidar Novo Membro
                        </DialogTitle>
                        <DialogDescription>
                            Um email será enviado com o link para aceitar o convite.
                            {activeWorkspace?.name && (
                                <span className="block mt-1 text-xs">
                                    Workspace: <strong>{activeWorkspace.name}</strong>
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="ws-invite-email" className="text-sm font-medium">
                                Email do convidado
                            </Label>
                            <Input
                                id="ws-invite-email"
                                type="email"
                                placeholder="email@exemplo.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && inviteEmail) {
                                        e.preventDefault();
                                        sendInviteMutation.mutate();
                                    }
                                }}
                                className="bg-background"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ws-invite-role" className="text-sm font-medium">
                                Função
                            </Label>
                            <Select value={inviteRole} onValueChange={(v: "admin" | "member") => setInviteRole(v)}>
                                <SelectTrigger id="ws-invite-role" className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">
                                        <div className="flex items-center gap-2">
                                            <User className="h-3.5 w-3.5" />
                                            <div className="text-left">
                                                <span className="font-medium">Membro</span>
                                                <p className="text-xs text-muted-foreground">Acesso limitado às pastas atribuídas</p>
                                            </div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="admin">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-3.5 w-3.5" />
                                            <div className="text-left">
                                                <span className="font-medium">Administrador</span>
                                                <p className="text-xs text-muted-foreground">Acesso total e pode gerenciar equipe</p>
                                            </div>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1.5">
                                <Mail className="h-3 w-3 shrink-0" />
                                O convite será enviado por email e expira em 7 dias
                            </p>
                            <p className="flex items-center gap-1.5">
                                <Users className="h-3 w-3 shrink-0" />
                                {membersUsed}/{membersLimit} membros ativos
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <DialogClose asChild>
                            <Button variant="outline" size="sm">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            onClick={() => sendInviteMutation.mutate()}
                            disabled={!inviteEmail || sendInviteMutation.isPending}
                            size="sm"
                            className="gap-2"
                        >
                            {sendInviteMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Enviar Convite
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Workspaces;
