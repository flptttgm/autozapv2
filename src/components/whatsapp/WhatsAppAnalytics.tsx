import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Users,
  Calendar
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface WhatsAppInstance {
  id: string;
  instance_id: string;
  phone: string | null;
}

interface InstanceStats {
  instance_id: string;
  instance_db_id: string;
  phone: string | null;
  total_messages: number;
  inbound_messages: number;
  outbound_messages: number;
  unique_leads: number;
  last_7_days: number[];
}

interface WhatsAppAnalyticsProps {
  instances: WhatsAppInstance[];
  workspaceId: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const WhatsAppAnalytics = ({ instances, workspaceId }: WhatsAppAnalyticsProps) => {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState<InstanceStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState({
    messages: 0,
    inbound: 0,
    outbound: 0,
    leads: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!workspaceId || instances.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const instanceStats: InstanceStats[] = [];

        // Fetch all messages for the workspace once
        const { data: allMessages, error } = await supabase
          .from('messages')
          .select('id, direction, created_at, lead_id, metadata')
          .eq('workspace_id', workspaceId);

        if (error) throw error;

        for (const instance of instances) {
          // Filter messages for this specific instance using metadata.instanceId
          const instanceMessages = allMessages?.filter(m =>
            (m.metadata as any)?.instanceId === instance.instance_id
          ) || [];

          const uniqueLeads = new Set(instanceMessages.map(m => m.lead_id).filter(Boolean));

          // Calculate last 7 days stats
          const last7Days = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));

            const dayMessages = instanceMessages.filter(m => {
              const msgDate = new Date(m.created_at || '');
              return msgDate >= dayStart && msgDate <= dayEnd;
            });

            last7Days.push(dayMessages.length);
          }

          const inbound = instanceMessages.filter(m => m.direction === 'inbound').length;
          const outbound = instanceMessages.filter(m => m.direction === 'outbound' || m.direction === 'outbound_manual').length;

          instanceStats.push({
            instance_id: instance.instance_id,
            instance_db_id: instance.id,
            phone: instance.phone,
            total_messages: instanceMessages.length,
            inbound_messages: inbound,
            outbound_messages: outbound,
            unique_leads: uniqueLeads.size,
            last_7_days: last7Days
          });
        }

        setStats(instanceStats);

        // Calculate totals
        const totalMessages = instanceStats.reduce((acc, s) => acc + s.total_messages, 0);
        const totalInbound = instanceStats.reduce((acc, s) => acc + s.inbound_messages, 0);
        const totalOutbound = instanceStats.reduce((acc, s) => acc + s.outbound_messages, 0);
        const totalLeads = instanceStats.reduce((acc, s) => acc + s.unique_leads, 0);

        setTotals({
          messages: totalMessages,
          inbound: totalInbound,
          outbound: totalOutbound,
          leads: totalLeads
        });

      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [instances, workspaceId]);

  if (isLoading) {
    return (
      <Card className="p-4 sm:p-6 glass border-border/40 shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-5 sm:h-6 bg-muted rounded w-1/4" />
          <div className="h-32 sm:h-40 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (instances.length === 0) {
    return null;
  }

  const chartData = stats.map((s, idx) => ({
    name: s.phone || `Conexão ${idx + 1}`,
    inbound: s.inbound_messages,
    outbound: s.outbound_messages,
    leads: s.unique_leads
  }));

  const pieData = stats.map((s, idx) => ({
    name: s.phone || `Conexão ${idx + 1}`,
    value: s.total_messages
  }));

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date().getDay();
  const last7DaysLabels = [];
  for (let i = 6; i >= 0; i--) {
    const dayIndex = (today - i + 7) % 7;
    last7DaysLabels.push(weekDays[dayIndex]);
  }

  const weeklyData = last7DaysLabels.map((day, idx) => {
    const data: { name: string;[key: string]: number | string } = { name: day };
    stats.forEach((s, sIdx) => {
      data[`Conexão ${sIdx + 1}`] = s.last_7_days[idx];
    });
    return data;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold mb-1">Analytics</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          <span className="sm:hidden">Estatísticas por conexão</span>
          <span className="hidden sm:inline">Estatísticas de mensagens por conexão</span>
        </p>
      </div>

      {/* KPI Cards - Grid 2x2 em mobile, 4 colunas em desktop */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold truncate">{totals.messages}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                <span className="sm:hidden">Mensagens</span>
                <span className="hidden sm:inline">Total de Mensagens</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10 shrink-0">
              <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold truncate">{totals.inbound}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Recebidas</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 shrink-0">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold truncate">{totals.outbound}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Enviadas</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10 shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold truncate">{totals.leads}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                <span className="sm:hidden">Leads</span>
                <span className="hidden sm:inline">Leads Únicos</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row - 1 coluna em mobile, 2 em desktop */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Messages by Connection */}
        <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
          <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="w-4 h-4" />
            <span className="sm:hidden">Por Conexão</span>
            <span className="hidden sm:inline">Mensagens por Conexão</span>
          </h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: isMobile ? 10 : 12 }}
                  className="text-muted-foreground"
                  width={isMobile ? 30 : 40}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: isMobile ? '12px' : '14px',
                    color: 'hsl(var(--foreground))'
                  }}
                />
                <Bar dataKey="inbound" name="Recebidas" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" name="Enviadas" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Distribution Pie Chart - Otimizado para Mobile */}
        <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
          <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
            <MessageSquare className="w-4 h-4" />
            <span className="sm:hidden">Distribuição</span>
            <span className="hidden sm:inline">Distribuição por Conexão</span>
          </h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={isMobile ? 35 : 50}
                  outerRadius={isMobile ? 60 : 80}
                  paddingAngle={2}
                  dataKey="value"
                  label={isMobile ? false : ({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: isMobile ? '12px' : '14px',
                    color: 'hsl(var(--foreground))'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                  formatter={(value) => <span className="text-[10px] sm:text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Weekly Activity */}
      <Card className="p-3 sm:p-4 glass border-border/40 shadow-sm">
        <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
          <Calendar className="w-4 h-4" />
          <span className="sm:hidden">Últimos 7 Dias</span>
          <span className="hidden sm:inline">Atividade dos Últimos 7 Dias</span>
        </h3>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: isMobile ? 10 : 12 }}
                className="text-muted-foreground"
                width={isMobile ? 30 : 40}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: isMobile ? '12px' : '14px',
                  color: 'hsl(var(--foreground))'
                }}
              />
              <Legend wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }} />
              {stats.map((_, idx) => (
                <Bar
                  key={`bar-${idx}`}
                  dataKey={`Conexão ${idx + 1}`}
                  fill={COLORS[idx % COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per Instance Stats - Grid responsivo */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat, idx) => (
          <Card key={stat.instance_db_id} className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h4 className="font-medium text-sm sm:text-base truncate pr-2">{stat.phone || `Conexão ${idx + 1}`}</h4>
              <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">
                {stat.instance_id.substring(0, 6)}...
              </Badge>
            </div>
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{stat.total_messages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recebidas</span>
                <span className="font-medium text-green-600">{stat.inbound_messages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enviadas</span>
                <span className="font-medium text-blue-600">{stat.outbound_messages}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leads</span>
                <span className="font-medium text-orange-600">{stat.unique_leads}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};