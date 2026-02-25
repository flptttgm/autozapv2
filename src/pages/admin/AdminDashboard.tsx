import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MetricsGrid } from "@/components/admin/MetricsCards";
import { EmbeddingMonitor } from "@/components/admin/EmbeddingMonitor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Building2, 
  MessageSquare, 
  UserPlus, 
  Smartphone,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentUser {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
}

interface ExpiringTrial {
  workspace_id: string;
  workspace_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  trial_end: string | null;
  days_remaining: number | null;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_platform_stats');
      if (error) throw error;
      return data[0];
    },
  });

  const { data: recentUsers } = useQuery({
    queryKey: ['admin-recent-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_recent_users', { days_limit: 7 });
      if (error) throw error;
      // Return only the first 5 users
      return ((data || []) as RecentUser[]).slice(0, 5);
    },
  });

  const { data: expiringTrials } = useQuery({
    queryKey: ['admin-expiring-trials'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_expiring_trials', { days_until_expiry: 2 });
      if (error) throw error;
      return (data || []) as ExpiringTrial[];
    },
  });

  const { data: recentWhatsApp } = useQuery({
    queryKey: ['admin-recent-whatsapp'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_whatsapp_instances');
      if (error) throw error;
      // Filter only recently created (last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      return (data || [])
        .filter((i: any) => i.created_at && i.created_at > sevenDaysAgo)
        .slice(0, 5);
    },
  });

  const { data: activityData } = useQuery({
    queryKey: ['admin-activity-chart'],
    queryFn: async () => {
      const days = 7;
      const result = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();
        
        const { count: messagesCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);
        
        result.push({
          date: format(date, 'EEE', { locale: ptBR }),
          mensagens: messagesCount || 0,
        });
      }
      
      return result;
    },
  });

  const metrics = [
    {
      title: "Total de Usuários",
      value: stats?.total_users?.toLocaleString() || '0',
      icon: Users,
      description: "Usuários cadastrados",
    },
    {
      title: "Workspaces",
      value: `${stats?.active_subscriptions?.toLocaleString() || '0'} ativos / ${stats?.total_workspaces?.toLocaleString() || '0'}`,
      icon: Building2,
      description: "Ativos do total cadastrados",
    },
    {
      title: "Leads",
      value: stats?.total_leads?.toLocaleString() || '0',
      icon: UserPlus,
      description: "Leads na plataforma",
    },
    {
      title: "Mensagens",
      value: stats?.total_messages?.toLocaleString() || '0',
      icon: MessageSquare,
      description: "Mensagens processadas",
    },
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard Administrativo</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Visão geral da plataforma
          </p>
        </div>

        {statsLoading ? (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <MetricsGrid metrics={metrics} />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <TrendingUp className="h-5 w-5" />
                Atividade Semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityData ? (
                <ChartContainer
                  config={{
                    mensagens: {
                      label: "Mensagens",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="mensagens" fill="var(--color-mensagens)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <Skeleton className="h-[200px]" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-5 w-5" />
                Usuários Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentUsers?.map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{user.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email || '-'}</p>
                    </div>
                    <p className="text-xs text-muted-foreground ml-2 shrink-0">
                      {user.created_at 
                        ? format(new Date(user.created_at), "dd/MM HH:mm", { locale: ptBR })
                        : '-'
                      }
                    </p>
                  </div>
                ))}
                {(!recentUsers || recentUsers.length === 0) && (
                  <p className="text-muted-foreground text-sm">Nenhum usuário recente</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {/* Embedding Monitor */}
          <div className="md:col-span-1">
            <EmbeddingMonitor />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Trials Expirando (48h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiringTrials && expiringTrials.length > 0 ? (
                <div className="space-y-3">
                  {expiringTrials.slice(0, 5).map((trial) => (
                    <div key={trial.workspace_id} className="text-sm border-b pb-2">
                      <p className="font-medium truncate">{trial.owner_name || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{trial.owner_email || '-'}</p>
                      <p className="text-xs text-yellow-500">
                        {trial.days_remaining != null 
                          ? `Expira em ${trial.days_remaining} dia${trial.days_remaining !== 1 ? 's' : ''}`
                          : trial.trial_end 
                            ? format(new Date(trial.trial_end), "dd/MM HH:mm", { locale: ptBR })
                            : '-'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum trial expirando</p>
              )}
              {expiringTrials && expiringTrials.length > 0 && (
                <Badge variant="outline" className="mt-2">
                  {expiringTrials.length} trials
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Conexões WhatsApp Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentWhatsApp && recentWhatsApp.length > 0 ? (
                <div className="space-y-3">
                  {recentWhatsApp.map((instance: any) => (
                    <div key={instance.id} className="text-sm border-b pb-2">
                      <p className="font-medium truncate">{instance.owner_email || 'Sem nome'}</p>
                      <p className="text-xs text-muted-foreground truncate">{instance.phone_number || '-'}</p>
                      <p className="text-xs text-green-500">
                        {instance.created_at 
                          ? format(new Date(instance.created_at), "dd/MM HH:mm", { locale: ptBR })
                          : '-'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma conexão recente</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Trials Ativos</p>
                <p className="text-2xl font-bold">{stats?.trial_users?.toLocaleString() || '0'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
                <p className="text-2xl font-bold">{stats?.active_subscriptions?.toLocaleString() || '0'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}