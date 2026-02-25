import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { UserPlus, Mail, Trash2, Crown, Shield, User, AlertTriangle, Users, FolderKey } from "lucide-react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useAuditLog } from "@/hooks/useAuditLog";
import { MemberAccessDialog } from "./MemberAccessDialog";
import { WorkspaceAccessManager } from "./WorkspaceAccessManager";

const inviteSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  role: z.enum(["admin", "member"]),
});

export const TeamSettings = () => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [accessMember, setAccessMember] = useState<{ id: string; name: string; role: string } | null>(null);
  const queryClient = useQueryClient();
  const { logChange } = useAuditLog();
  const { user } = useAuth();
  const { membersUsed, membersLimit, canAddMember } = useSubscription();

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
        .eq("id", user.id)
        .single();
      return profile?.workspace_id;
    },
    enabled: !!user?.id,
  });

  const { data: members } = useQuery({
    queryKey: ["team-members", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("workspace_members")
        .select("*, profiles(full_name, id)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
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

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const validated = inviteSchema.parse({ email, role });

      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: { email: validated.email, role: validated.role },
      });

      if (error) {
        // Try to extract the actual error message from the response body
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
    onSuccess: () => {
      toast.success("Convite enviado!");
      logChange({
        action: 'create',
        entity_type: 'invite',
        changes_summary: `Convite enviado para ${email} como ${role}`,
      });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      queryClient.invalidateQueries({ queryKey: ["members-used"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar convite");
    },
  });

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
      toast.success("Membro removido");
      logChange({
        action: 'delete',
        entity_type: 'workspace_member',
        changes_summary: `Membro ${data.memberName} removido da equipe`,
      });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["members-used"] });
    },
    onError: () => {
      toast.error("Erro ao remover membro");
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Proprietário";
      case "admin":
        return "Administrador";
      default:
        return "Membro";
    }
  };

  const pendingCount = invites?.length || 0;
  const totalUsed = membersUsed + pendingCount;

  return (
    <div className="space-y-6">
      {/* Send Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            Convidar Novo Membro
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>
              {membersUsed}/{membersLimit} membros
              {pendingCount > 0 && ` (+${pendingCount} pendentes)`}
            </span>
            {workspace?.name && <span className="text-muted-foreground">• {workspace.name}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canAddMember && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Limite de {membersLimit} membros atingido.</span>
                <Link to="/plans" className="font-medium underline underline-offset-4 hover:text-destructive-foreground">
                  Fazer upgrade
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canAddMember}
              />
            </div>
            <div className="w-full sm:w-48 space-y-2">
              <Label htmlFor="role">Função</Label>
              <Select value={role} onValueChange={(v: "admin" | "member") => setRole(v)} disabled={!canAddMember}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => sendInviteMutation.mutate()}
                disabled={!email || sendInviteMutation.isPending || !canAddMember}
                className="w-full sm:w-auto"
              >
                Enviar Convite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {invites && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" />
              Convites Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{invite.email}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {getRoleLabel(invite.role)} • Expira em{" "}
                        {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="self-start sm:self-auto shrink-0">Pendente</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Membros da Equipe ({members?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members?.map((member: any) => (
              <div
                key={member.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {getRoleIcon(member.role)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.profiles?.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">
                      {getRoleLabel(member.role)}
                    </p>
                  </div>
                </div>
                {member.role !== "owner" && (
                  <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                    {member.role === "member" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Gerenciar acessos"
                        onClick={() => setAccessMember({
                          id: member.id,
                          name: member.profiles?.full_name || "Sem nome",
                          role: member.role,
                        })}
                      >
                        <FolderKey className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMemberMutation.mutate({
                        memberId: member.id,
                        memberName: member.profiles?.full_name || "Sem nome"
                      })}
                      disabled={removeMemberMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Access Manager (Admin/Owner only) */}
      <WorkspaceAccessManager />

      {/* Member Access Dialog */}
      {accessMember && (
        <MemberAccessDialog
          open={!!accessMember}
          onOpenChange={(open) => { if (!open) setAccessMember(null); }}
          member={accessMember}
        />
      )}
    </div>
  );
};
