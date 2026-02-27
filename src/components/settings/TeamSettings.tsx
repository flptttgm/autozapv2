import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  UserPlus, Mail, Trash2, Crown, Shield, User, AlertTriangle, Users,
  FolderKey, MoreVertical, Send, Clock, XCircle, Loader2, CalendarDays, Copy, MessageCircle, Check, Layers,
} from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useAuditLog } from "@/hooks/useAuditLog";
import { MemberAccessDialog } from "./MemberAccessDialog";
import { usePresenceContext } from "@/hooks/useWorkspacePresence";

function getInviteUrl(token: string) {
  return `${window.location.origin}/accept-invite?token=${token}`;
}

function shareViaWhatsApp(inviteUrl: string, workspaceName?: string) {
  const message = `Olá! Você foi convidado(a) para fazer parte da equipe${workspaceName ? ` *${workspaceName}*` : ''} no AutoZap. Clique no link abaixo para aceitar o convite:\n\n${inviteUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

const inviteSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  role: z.enum(["admin", "member"]),
});

// Avatar colors based on name hash
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Expirado";
  if (diffDays === 0) return "Expira hoje";
  if (diffDays === 1) return "Expira amanhã";
  return `Expira em ${diffDays} dias`;
}

function getMemberSince(dateStr: string) {
  const date = new Date(dateStr);
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  return `Desde ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
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

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  member: "bg-muted text-muted-foreground border-border/50",
};

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Membro",
};

const getRoleIcon = (role: string) => {
  switch (role) {
    case "owner":
      return <Crown className="h-3.5 w-3.5" />;
    case "admin":
      return <Shield className="h-3.5 w-3.5" />;
    default:
      return <User className="h-3.5 w-3.5" />;
  }
};

export const TeamSettings = () => {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);
  const [lastInviteEmail, setLastInviteEmail] = useState<string>("");
  const [accessMember, setAccessMember] = useState<{ id: string; name: string; role: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string; type: "member" | "invite" } | null>(null);
  const [workspaceMember, setWorkspaceMember] = useState<{ userId: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { logChange } = useAuditLog();
  const { user } = useAuth();
  const { membersUsed, membersLimit, canAddMember } = useSubscription();
  const { canManageTeam, isOwner } = useWorkspaceRole();

  const { data: workspace } = useQuery({
    queryKey: ["workspace", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id, workspaces(name)")
        .eq("id", user.id)
        .single();

      return profile?.workspaces as any;
    },
    enabled: !!user?.id,
  });

  const { data: workspaceId } = useQuery({
    queryKey: ["user-workspace-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_id")
        .eq("user_id", user.id)
        .single();
      return profile?.workspace_id;
    },
    enabled: !!user?.id,
  });

  const { onlineUserIds } = usePresenceContext();

  // Fetch all workspaces owned by the current user
  const { data: allWorkspaces } = useQuery({
    queryKey: ["all-owner-workspaces", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: members } = useQuery({
    queryKey: ["team-members", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      // Fetch workspace members
      const { data: memberRows, error: membersError } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;
      if (!memberRows || memberRows.length === 0) return [];

      // Fetch profiles for all member user_ids
      const userIds = memberRows.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, last_seen_at")
        .in("user_id", userIds);

      // Merge profiles into members
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Fetch ALL workspace memberships for these users (multi-workspace)
      const { data: allMemberships } = await supabase
        .from("workspace_members")
        .select("user_id, workspace_id, workspaces(name)")
        .in("user_id", userIds);

      // Group memberships by user_id
      const membershipMap = new Map<string, any[]>();
      (allMemberships || []).forEach((m: any) => {
        const arr = membershipMap.get(m.user_id) || [];
        arr.push(m);
        membershipMap.set(m.user_id, arr);
      });

      return memberRows.map((m: any) => ({
        ...m,
        profile: profileMap.get(m.user_id) || null,
        allWorkspaces: membershipMap.get(m.user_id) || [],
      }));
    },
    enabled: !!workspaceId,
  });

  const { data: invites } = useQuery({
    queryKey: ["invites", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  // Send invite
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const validated = inviteSchema.parse({ email, role });

      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { email: validated.email, role: validated.role },
      });

      if (error) {
        const context = (error as any)?.context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (body?.error) throw new Error(body.error);
          } catch (_) {
            // json parsing failed, fall through
          }
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.invite?.token) {
        setLastInviteToken(data.invite.token);
        setLastInviteEmail(email);
      }
      if (data?.email_sent !== false) {
        toast.success("Convite enviado por email!");
      }
      logChange({
        action: 'create',
        entity_type: 'invite',
        changes_summary: `Convite enviado para ${email} como ${role}`,
      });
      setEmail("");
      setRole("member");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      queryClient.invalidateQueries({ queryKey: ["members-used"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    },
  });

  // Cancel invite
  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite cancelado");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      queryClient.invalidateQueries({ queryKey: ["members-used"] });
      setConfirmRemove(null);
    },
    onError: () => {
      toast.error("Erro ao cancelar convite");
    },
  });

  // Resend invite
  const resendInviteMutation = useMutation({
    mutationFn: async ({ email: inviteEmail, role: inviteRole }: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Convite reenviado!");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao reenviar convite");
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId, memberName }: { memberId: string; memberName: string }) => {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      return { memberName };
    },
    onSuccess: (data) => {
      toast.success(`${data.memberName} removido da equipe`);
      logChange({
        action: 'delete',
        entity_type: 'workspace_member',
        changes_summary: `Membro ${data.memberName} removido da equipe`,
      });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-access-members"] });
      queryClient.invalidateQueries({ queryKey: ["members-used"] });
      setConfirmRemove(null);
    },
    onError: () => {
      toast.error("Erro ao remover membro");
    },
  });

  // Update role
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
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-access-members"] });
    },
    onError: () => {
      toast.error("Erro ao atualizar permissão");
    },
  });

  const pendingCount = invites?.length || 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* ── Header Card ── */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
          <CardHeader className="relative pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2.5 text-xl">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  Equipe
                </CardTitle>
                <CardDescription className="flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {membersUsed}/{membersLimit} membros ativos
                  </span>
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="text-xs gap-1 font-normal">
                      <Clock className="h-3 w-3" />
                      {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                    </Badge>
                  )}
                  {workspace?.name && (
                    <span className="text-muted-foreground/60 hidden sm:inline">
                      • {workspace.name}
                    </span>
                  )}
                </CardDescription>
              </div>

              <Button
                onClick={() => {
                  setLastInviteToken(null);
                  setLastInviteEmail("");
                  setInviteDialogOpen(true);
                }}
                disabled={!canAddMember}
                className="gap-2 shadow-sm"
                size="sm"
              >
                <UserPlus className="h-4 w-4" />
                Convidar Membro
              </Button>
            </div>

            {!canAddMember && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Limite de {membersLimit} membros atingido.</span>
                  <Link to="/plans" className="font-medium underline underline-offset-4 hover:text-destructive-foreground">
                    Fazer upgrade
                  </Link>
                </AlertDescription>
              </Alert>
            )}
          </CardHeader>
        </Card>

        {/* ── Pending Invites ── */}
        {invites && invites.length > 0 && (
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Mail className="h-4 w-4 text-amber-500" />
                Convites Pendentes
                <Badge variant="outline" className="ml-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  {invites.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {invites.map((invite) => {
                  const expiryText = getRelativeTime(invite.expires_at);
                  const isExpired = expiryText === "Expirado";

                  return (
                    <div
                      key={invite.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Mail className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{invite.email}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleBadgeStyles[invite.role] || roleBadgeStyles.member}`}>
                              {getRoleIcon(invite.role)}
                              <span className="ml-1">{roleLabels[invite.role] || "Membro"}</span>
                            </Badge>
                            <span className={`flex items-center gap-1 ${isExpired ? "text-destructive" : ""}`}>
                              <Clock className="h-3 w-3" />
                              {expiryText}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-auto shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const url = getInviteUrl(invite.token);
                                navigator.clipboard.writeText(url);
                                toast.success("Link copiado!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copiar link</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              onClick={() => shareViaWhatsApp(getInviteUrl(invite.token), workspace?.name)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Enviar por WhatsApp</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() =>
                                resendInviteMutation.mutate({ email: invite.email, role: invite.role })
                              }
                              disabled={resendInviteMutation.isPending}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reenviar por email</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmRemove({ id: invite.id, name: invite.email, type: "invite" })}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cancelar convite</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Team Members ── */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Membros
              <Badge variant="outline" className="ml-1 text-xs">
                {members?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {members?.map((member: any) => {
                const memberName = member.profile?.display_name || "Sem nome";
                const initials = getInitials(memberName);
                const colorClass = getAvatarColor(memberName);
                const isCurrentUser = member.user_id === user?.id;
                const isOnline = onlineUserIds.has(member.user_id);
                const canChangeRole = isOwner && member.role !== "owner" && !isCurrentUser;
                const canRemoveMember =
                  canManageTeam && member.role !== "owner" && !isCurrentUser &&
                  (isOwner || member.role === "member");
                const canManageAccess = member.role === "member" && canManageTeam;

                return (
                  <div
                    key={member.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Avatar with initials + online indicator */}
                      <div className="relative">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm ${colorClass}`}
                        >
                          {initials || <User className="h-4 w-4" />}
                        </div>
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
                            {getRoleIcon(member.role)}
                            <span>{roleLabels[member.role] || "Membro"}</span>
                          </Badge>
                          {/* Workspace badges (only for 'member' role) */}
                          {member.role === "member" && member.allWorkspaces?.length > 0 && member.allWorkspaces.map((ws: any) => {
                            const wsName = ws.workspace_id === workspaceId
                              ? (workspace?.name || "Geral")
                              : ((ws.workspaces as any)?.name || "Workspace");
                            return (
                              <Badge
                                key={ws.workspace_id}
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                              >
                                <Layers className="h-2.5 w-2.5" />
                                <span className="max-w-[80px] truncate">{wsName}</span>
                              </Badge>
                            );
                          })}
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

                    {/* Actions */}
                    {(canChangeRole || canRemoveMember || canManageAccess) && (
                      <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {canManageAccess && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setAccessMember({
                                    id: member.id,
                                    name: memberName,
                                    role: member.role,
                                  })
                                }
                              >
                                <FolderKey className="h-4 w-4 mr-2" />
                                Gerenciar Acessos
                              </DropdownMenuItem>
                            )}
                            {isOwner && member.role !== "owner" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  setWorkspaceMember({
                                    userId: member.user_id,
                                    name: memberName,
                                  })
                                }
                              >
                                <Layers className="h-4 w-4 mr-2" />
                                Gerenciar Workspaces
                              </DropdownMenuItem>
                            )}
                            {canChangeRole && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateRoleMutation.mutate({
                                      memberId: member.id,
                                      newRole: member.role === "admin" ? "member" : "admin",
                                    })
                                  }
                                >
                                  {member.role === "admin" ? (
                                    <>
                                      <User className="h-4 w-4 mr-2" />
                                      Rebaixar para Membro
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="h-4 w-4 mr-2" />
                                      Promover a Admin
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                            {canRemoveMember && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setConfirmRemove({
                                      id: member.id,
                                      name: memberName,
                                      type: "member",
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remover da Equipe
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                );
              })}

              {(!members || members.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum membro na equipe</p>
                  <p className="text-xs mt-1">Convide membros para começar a colaborar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Invite Dialog ── */}
        <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setLastInviteToken(null);
            setLastInviteEmail("");
          }
          setInviteDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-md">
            {lastInviteToken ? (
              /* ── Success State with Invite Link ── */
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Check className="h-4 w-4 text-emerald-500" />
                    </div>
                    Convite Criado!
                  </DialogTitle>
                  <DialogDescription>
                    Convite enviado para <strong>{lastInviteEmail}</strong>. Compartilhe o link abaixo:
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <input
                      readOnly
                      value={getInviteUrl(lastInviteToken)}
                      className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(getInviteUrl(lastInviteToken));
                        toast.success("Link copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(getInviteUrl(lastInviteToken));
                        toast.success("Link copiado!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Link
                    </Button>
                    <Button
                      className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => shareViaWhatsApp(getInviteUrl(lastInviteToken), workspace?.name)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLastInviteToken(null);
                      setLastInviteEmail("");
                    }}
                    className="gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Convidar Outro
                  </Button>
                  <DialogClose asChild>
                    <Button size="sm">Fechar</Button>
                  </DialogClose>
                </DialogFooter>
              </>
            ) : (
              /* ── Invite Form ── */
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                    Convidar Novo Membro
                  </DialogTitle>
                  <DialogDescription>
                    Um email será enviado com o link para aceitar o convite.
                    {workspace?.name && (
                      <span className="block mt-1 text-xs">
                        Workspace: <strong>{workspace.name}</strong>
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email" className="text-sm font-medium">
                      Email do convidado
                    </Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && email) {
                          e.preventDefault();
                          sendInviteMutation.mutate();
                        }
                      }}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-role" className="text-sm font-medium">
                      Função
                    </Label>
                    <Select value={role} onValueChange={(v: "admin" | "member") => setRole(v)}>
                      <SelectTrigger id="invite-role" className="bg-background">
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
                      {membersUsed}/{membersLimit} membros • {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
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
                    disabled={!email || sendInviteMutation.isPending}
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
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Confirm Remove Dialog ── */}
        <AlertDialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmRemove?.type === "invite" ? "Cancelar Convite" : "Remover Membro"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmRemove?.type === "invite" ? (
                  <>
                    Tem certeza que deseja cancelar o convite para <strong>{confirmRemove?.name}</strong>?
                    O link de convite será invalidado.
                  </>
                ) : (
                  <>
                    Tem certeza que deseja remover <strong>{confirmRemove?.name}</strong> da equipe?
                    Essa pessoa perderá acesso a todos os dados do workspace.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!confirmRemove) return;
                  if (confirmRemove.type === "invite") {
                    cancelInviteMutation.mutate(confirmRemove.id);
                  } else {
                    removeMemberMutation.mutate({
                      memberId: confirmRemove.id,
                      memberName: confirmRemove.name,
                    });
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {(cancelInviteMutation.isPending || removeMemberMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {confirmRemove?.type === "invite" ? "Cancelando..." : "Removendo..."}
                  </>
                ) : (
                  confirmRemove?.type === "invite" ? "Cancelar Convite" : "Remover"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Member Access Dialog ── */}
        {accessMember && (
          <MemberAccessDialog
            open={!!accessMember}
            onOpenChange={(open) => { if (!open) setAccessMember(null); }}
            member={accessMember}
          />
        )}

        {/* ── Workspace Assignment Dialog ── */}
        <Dialog open={!!workspaceMember} onOpenChange={(open) => { if (!open) setWorkspaceMember(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Gerenciar Workspaces
              </DialogTitle>
              <DialogDescription>
                Selecione os workspaces que <strong>{workspaceMember?.name}</strong> pode acessar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
              {allWorkspaces?.map((ws: any) => {
                const memberWs = members?.find(
                  (m: any) => m.user_id === workspaceMember?.userId
                );
                const allMemberWs = memberWs?.allWorkspaces || [];
                const isInWorkspace = allMemberWs.some(
                  (mw: any) => mw.workspace_id === ws.id
                );

                return (
                  <div
                    key={ws.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${isInWorkspace
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/50 bg-muted/20 hover:bg-muted/40"
                      }`}
                    onClick={async () => {
                      if (!workspaceMember) return;
                      try {
                        if (isInWorkspace) {
                          const { error } = await supabase
                            .from("workspace_members")
                            .delete()
                            .eq("workspace_id", ws.id)
                            .eq("user_id", workspaceMember.userId);
                          if (error) throw error;
                          toast.success(`${workspaceMember.name} removido de ${ws.name}`);
                        } else {
                          const { error } = await supabase
                            .from("workspace_members")
                            .insert({
                              workspace_id: ws.id,
                              user_id: workspaceMember.userId,
                              role: "member",
                            });
                          if (error) throw error;
                          toast.success(`${workspaceMember.name} adicionado a ${ws.name}`);
                        }
                        queryClient.invalidateQueries({ queryKey: ["team-members"] });
                      } catch (err: any) {
                        toast.error("Erro ao atualizar workspace: " + err.message);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${isInWorkspace
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {ws.name?.charAt(0)?.toUpperCase() || "W"}
                      </div>
                      <span className="text-sm font-medium">{ws.name}</span>
                    </div>
                    <div
                      className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${isInWorkspace
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                        }`}
                    >
                      {isInWorkspace && <Check className="h-3 w-3" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider >
  );
};
