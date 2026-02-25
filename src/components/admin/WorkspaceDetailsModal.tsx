import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Mail, 
  Calendar, 
  CreditCard, 
  MessageSquare, 
  Users as UsersIcon,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WorkspaceWithStats {
  id: string;
  name: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  created_at: string | null;
  plan_type?: string | null;
  plan_status?: string | null;
  leads_count?: number;
  messages_count?: number;
  members_count?: number;
  whatsapp_status?: string | null;
}

interface WorkspaceDetailsModalProps {
  workspace: WorkspaceWithStats | null;
  open: boolean;
  onClose: () => void;
}

export function WorkspaceDetailsModal({ workspace, open, onClose }: WorkspaceDetailsModalProps) {
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['workspace-members', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data } = await supabase
        .from('workspace_members')
        .select(`
          id,
          role,
          created_at,
          profiles:user_id (
            full_name
          )
        `)
        .eq('workspace_id', workspace.id);
      return data || [];
    },
    enabled: !!workspace?.id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['workspace-subscription', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();
      return data;
    },
    enabled: !!workspace?.id,
  });

  const { data: whatsappInstance } = useQuery({
    queryKey: ['workspace-whatsapp', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return null;
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();
      return data;
    },
    enabled: !!workspace?.id,
  });

  const getPlanBadge = (planType: string | null) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      enterprise: "default",
      pro: "default",
      basic: "secondary",
      trial: "outline",
    };
    return variants[planType || 'trial'] || "secondary";
  };

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Detalhes do Workspace
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Workspace Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Informações do Workspace
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium truncate">{workspace.name || 'Sem nome'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {workspace.created_at 
                      ? format(new Date(workspace.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proprietário</p>
                  <p className="font-medium truncate">{workspace.owner_name || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{workspace.owner_email || '-'}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <Badge variant={getPlanBadge(workspace.plan_type)}>
                    {workspace.plan_type || 'trial'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={workspace.plan_status === 'active' ? 'default' : 'secondary'}>
                    {workspace.plan_status || 'active'}
                  </Badge>
                </div>
                {subscription?.trial_ends_at && workspace.plan_type === 'trial' && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Trial expira em</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(subscription.trial_ends_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold">{workspace.leads_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Leads</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold">{workspace.messages_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Mensagens</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xl sm:text-2xl font-bold">{workspace.members_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Membros</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center flex flex-col items-center">
                  {workspace.whatsapp_status === 'connected' ? (
                    <CheckCircle className="h-5 sm:h-6 w-5 sm:w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-5 sm:h-6 w-5 sm:w-6 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">WhatsApp</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WhatsApp Instance */}
          {whatsappInstance && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Instância WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">{whatsappInstance.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={whatsappInstance.status === 'connected' ? 'default' : 'secondary'}>
                      {whatsappInstance.status || 'pendente'}
                    </Badge>
                  </div>
                  {whatsappInstance.connected_at && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Conectado em</p>
                      <p className="font-medium">
                        {format(new Date(whatsappInstance.connected_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Members */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UsersIcon className="h-4 w-4" />
                Membros ({workspace.members_count ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {membersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : members && members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between text-sm border-b pb-2">
                      <p className="font-medium truncate flex-1">{member.profiles?.full_name || 'Sem nome'}</p>
                      <Badge variant="outline" className="ml-2">{member.role}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum membro encontrado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
