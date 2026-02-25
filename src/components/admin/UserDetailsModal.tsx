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
  User, 
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

interface UserWithStats {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  workspace_id: string | null;
  workspace_name?: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  plan_type?: string | null;
  plan_status?: string | null;
  leads_count?: number;
  messages_count?: number;
  whatsapp_connected?: boolean;
}

interface UserDetailsModalProps {
  user: UserWithStats | null;
  open: boolean;
  onClose: () => void;
}

export function UserDetailsModal({ user, open, onClose }: UserDetailsModalProps) {
  const { data: whatsappInstance } = useQuery({
    queryKey: ['user-whatsapp', user?.workspace_id],
    queryFn: async () => {
      if (!user?.workspace_id) return null;
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('workspace_id', user.workspace_id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.workspace_id,
  });

  const { data: subscription } = useQuery({
    queryKey: ['user-subscription', user?.workspace_id],
    queryFn: async () => {
      if (!user?.workspace_id) return null;
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('workspace_id', user.workspace_id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.workspace_id,
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['user-activity', user?.workspace_id],
    queryFn: async () => {
      if (!user?.workspace_id) return [];
      const { data } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', user.workspace_id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user?.workspace_id,
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

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium truncate">{user.full_name || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.email || 'Não informado'}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Empresa</p>
                  <p className="font-medium flex items-center gap-1 truncate">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.company_name || 'Não informada'}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {user.created_at 
                      ? format(new Date(user.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Status:</p>
                <Badge variant={user.onboarding_completed ? "default" : "secondary"}>
                  {user.onboarding_completed ? 'Onboarding Completo' : 'Onboarding Pendente'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Workspace & Subscription */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Workspace & Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Workspace</p>
                  <p className="font-medium truncate">{user.workspace_name || 'Não criado'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <Badge variant={getPlanBadge(user.plan_type)}>
                    {user.plan_type || 'trial'}
                  </Badge>
                </div>
                {subscription?.trial_ends_at && user.plan_type === 'trial' && (
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
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{user.leads_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold">{user.messages_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Mensagens</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1">
                    {user.whatsapp_connected ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <p className="text-xs text-muted-foreground hidden sm:block">WhatsApp</p>
                  </div>
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

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{log.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{log.entity_type}</p>
                      </div>
                      <p className="text-xs text-muted-foreground ml-2 shrink-0">
                        {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
