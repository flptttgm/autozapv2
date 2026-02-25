import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Gift, Users, DollarSign, TrendingUp, Clock, CheckCircle, Link as LinkIcon, Zap } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReferralStats {
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  total_paid: number;
  standard_link_signups: number;
  custom_link_signups: number;
  standard_completed: number;
  custom_completed: number;
}

interface Referral {
  id: string;
  referrer_workspace_id: string;
  referred_workspace_id: string | null;
  referral_code: string;
  status: string;
  credit_amount: number;
  created_at: string;
  completed_at: string | null;
  source?: string;
  redirect_path?: string;
  referrer_name?: string;
  referrer_email?: string;
  referred_name?: string;
  referred_email?: string;
}

export default function AdminReferrals() {
  // Stats gerais
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-referral-stats'],
    queryFn: async () => {
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select('*');
      
      if (error) throw error;

      const total = referrals?.length || 0;
      const completed = referrals?.filter(r => r.status === 'completed').length || 0;
      const pending = referrals?.filter(r => r.status === 'pending').length || 0;
      const totalPaid = referrals
        ?.filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + Number(r.credit_amount || 0), 0) || 0;

      // Track by source
      const standardSignups = referrals?.filter(r => r.source === 'standard' || !r.source).length || 0;
      const customSignups = referrals?.filter(r => r.source === 'custom').length || 0;
      const standardCompleted = referrals?.filter(r => (r.source === 'standard' || !r.source) && r.status === 'completed').length || 0;
      const customCompleted = referrals?.filter(r => r.source === 'custom' && r.status === 'completed').length || 0;

      return {
        total_referrals: total,
        completed_referrals: completed,
        pending_referrals: pending,
        total_paid: totalPaid,
        standard_link_signups: standardSignups,
        custom_link_signups: customSignups,
        standard_completed: standardCompleted,
        custom_completed: customCompleted,
      } as ReferralStats;
    },
  });

  // Lista de indicações com dados dos workspaces
  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ['admin-referrals-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:workspaces!referrals_referrer_workspace_id_fkey(
            id,
            name,
            owner_id
          ),
          referred:workspaces!referrals_referred_workspace_id_fkey(
            id,
            name,
            owner_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar emails dos owners
      const referralsWithEmails = await Promise.all(
        (data || []).map(async (ref: any) => {
          let referrerEmail = null;
          let referredEmail = null;

          if (ref.referrer?.owner_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', ref.referrer.owner_id)
              .single();
            referrerEmail = profile?.full_name;
          }

          if (ref.referred?.owner_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', ref.referred.owner_id)
              .single();
            referredEmail = profile?.full_name;
          }

          return {
            ...ref,
            referrer_name: ref.referrer?.name || '-',
            referrer_email: referrerEmail || '-',
            referred_name: ref.referred?.name || '-',
            referred_email: referredEmail || '-',
          };
        })
      );

      return referralsWithEmails as Referral[];
    },
  });

  // Dados para gráfico de tendência (últimos 30 dias)
  const { data: trendData } = useQuery({
    queryKey: ['admin-referral-trend'],
    queryFn: async () => {
      const days = 30;
      const { data, error } = await supabase
        .from('referrals')
        .select('created_at, status')
        .gte('created_at', subDays(new Date(), days).toISOString());

      if (error) throw error;

      // Agrupar por semana
      const weeklyData: Record<string, { total: number; completed: number }> = {};
      
      (data || []).forEach((ref) => {
        const week = format(new Date(ref.created_at), 'dd/MM');
        if (!weeklyData[week]) {
          weeklyData[week] = { total: 0, completed: 0 };
        }
        weeklyData[week].total++;
        if (ref.status === 'completed') {
          weeklyData[week].completed++;
        }
      });

      return Object.entries(weeklyData)
        .slice(-7)
        .map(([date, values]) => ({
          date,
          indicacoes: values.total,
          convertidas: values.completed,
        }));
    },
  });

  // Top indicadores
  const { data: topReferrers } = useQuery({
    queryKey: ['admin-top-referrers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, referral_balance, referral_code')
        .gt('referral_balance', 0)
        .order('referral_balance', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    completed: 'bg-green-500/10 text-green-500 border-green-500/20',
    cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendente',
    completed: 'Concluída',
    cancelled: 'Cancelada',
  };

  const pieData = stats ? [
    { name: 'Concluídas', value: stats.completed_referrals, color: 'hsl(var(--chart-1))' },
    { name: 'Pendentes', value: stats.pending_referrals, color: 'hsl(var(--chart-2))' },
  ] : [];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Gift className="h-8 w-8 text-primary" />
            Programa de Indicações
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gerencie e visualize estatísticas do programa de indicação
          </p>
        </div>

        {/* Métricas principais */}
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
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Indicações</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_referrals || 0}</div>
                <p className="text-xs text-muted-foreground">todas as indicações</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Convertidas</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{stats?.completed_referrals || 0}</div>
                <p className="text-xs text-muted-foreground">indicações concluídas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{stats?.pending_referrals || 0}</div>
                <p className="text-xs text-muted-foreground">aguardando conversão</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  R$ {(stats?.total_paid || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">em bonificações</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Métricas por tipo de link */}
        {!statsLoading && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Link Normal</CardTitle>
                <LinkIcon className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">{stats?.standard_link_signups || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.standard_completed || 0} convertidas ({stats?.standard_link_signups ? Math.round((stats.standard_completed / stats.standard_link_signups) * 100) : 0}%)
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Link Personalizado</CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-500">{stats?.custom_link_signups || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.custom_completed || 0} convertidas ({stats?.custom_link_signups ? Math.round((stats.custom_completed / stats.custom_link_signups) * 100) : 0}%)
                </p>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Comparativo de Conversão</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-blue-500">Normal</span>
                      <span>{stats?.standard_link_signups ? Math.round((stats.standard_completed / stats.standard_link_signups) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${stats?.standard_link_signups ? (stats.standard_completed / stats.standard_link_signups) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-purple-500">Personalizado</span>
                      <span>{stats?.custom_link_signups ? Math.round((stats.custom_completed / stats.custom_link_signups) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${stats?.custom_link_signups ? (stats.custom_completed / stats.custom_link_signups) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5" />
                Tendência de Indicações (Últimos 30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trendData && trendData.length > 0 ? (
                <ChartContainer
                  config={{
                    indicacoes: { label: "Indicações", color: "hsl(var(--primary))" },
                    convertidas: { label: "Convertidas", color: "hsl(var(--chart-1))" },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="indicacoes" fill="var(--color-indicacoes)" radius={4} />
                      <Bar dataKey="convertidas" fill="var(--color-convertidas)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 && (pieData[0].value > 0 || pieData[1].value > 0) ? (
                <ChartContainer
                  config={{
                    concluidas: { label: "Concluídas", color: "hsl(var(--chart-1))" },
                    pendentes: { label: "Pendentes", color: "hsl(var(--chart-2))" },
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
              <div className="flex justify-center gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
                  <span className="text-xs">Concluídas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
                  <span className="text-xs">Pendentes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Indicadores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-5 w-5" />
              Top Indicadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topReferrers && topReferrers.length > 0 ? (
              <div className="space-y-4">
                {topReferrers.map((referrer, index) => (
                  <div key={referrer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{referrer.name}</p>
                        <p className="text-xs text-muted-foreground">Código: {referrer.referral_code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">
                        R$ {Number(referrer.referral_balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">acumulado</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum indicador ainda</p>
            )}
          </CardContent>
        </Card>

        {/* Tabela de indicações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Indicações</CardTitle>
          </CardHeader>
          <CardContent>
            {referralsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : referrals && referrals.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead>Indicado</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Concluído em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{referral.referrer_name}</p>
                            <p className="text-xs text-muted-foreground">{referral.referrer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{referral.referred_name}</p>
                            <p className="text-xs text-muted-foreground">{referral.referred_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {referral.referral_code}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[referral.status] || ''}>
                            {statusLabels[referral.status] || referral.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          R$ {Number(referral.credit_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(referral.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {referral.completed_at 
                            ? format(new Date(referral.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma indicação registrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
