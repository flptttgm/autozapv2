import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LogIn, MessageSquare, Send, Wifi } from "lucide-react";

interface DayStats {
  date: string;
  logins: number;
  messagesReceived: number;
  messagesSent: number;
  connectedInstances: number;
}

export default function AdminLogins() {
  // Fetch logins
  const { data: loginsData, isLoading: isLoadingLogins } = useQuery({
    queryKey: ['admin-logins-by-day'],
    queryFn: async () => {
      let allData: { created_at: string | null }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('platform_logs')
          .select('created_at')
          .eq('action', 'login')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const groupedByDay = allData.reduce((acc, log) => {
        if (!log.created_at) return acc;
        const date = format(new Date(log.created_at), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return groupedByDay;
    },
  });

  // Fetch messages
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['admin-messages-by-day'],
    queryFn: async () => {
      let allData: { created_at: string | null; direction: string }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('messages')
          .select('created_at, direction')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const groupedByDay = allData.reduce((acc, msg) => {
        if (!msg.created_at) return acc;
        const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
        if (!acc[date]) {
          acc[date] = { received: 0, sent: 0 };
        }
        if (msg.direction === 'inbound') {
          acc[date].received += 1;
        } else if (msg.direction === 'outbound' || msg.direction === 'outbound_manual') {
          acc[date].sent += 1;
        }
        return acc;
      }, {} as Record<string, { received: number; sent: number }>);

      return groupedByDay;
    },
  });

  // Fetch connected instances per day
  const { data: instancesData, isLoading: isLoadingInstances } = useQuery({
    queryKey: ['admin-instances-by-day'],
    queryFn: async () => {
      let allData: { created_at: string | null }[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('whatsapp_instances')
          .select('created_at')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const groupedByDay = allData.reduce((acc, instance) => {
        if (!instance.created_at) return acc;
        const date = format(new Date(instance.created_at), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return groupedByDay;
    },
  });

  // Combine data
  const dayStats: DayStats[] = (() => {
    const allDates = new Set<string>();
    
    if (loginsData) {
      Object.keys(loginsData).forEach(date => allDates.add(date));
    }
    if (messagesData) {
      Object.keys(messagesData).forEach(date => allDates.add(date));
    }
    if (instancesData) {
      Object.keys(instancesData).forEach(date => allDates.add(date));
    }

    return Array.from(allDates)
      .map(date => ({
        date,
        logins: loginsData?.[date] || 0,
        messagesReceived: messagesData?.[date]?.received || 0,
        messagesSent: messagesData?.[date]?.sent || 0,
        connectedInstances: instancesData?.[date] || 0,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  })();

  const isLoading = isLoadingLogins || isLoadingMessages || isLoadingInstances;
  const totalLogins = dayStats.reduce((sum, day) => sum + day.logins, 0);
  const totalReceived = dayStats.reduce((sum, day) => sum + day.messagesReceived, 0);
  const totalSent = dayStats.reduce((sum, day) => sum + day.messagesSent, 0);
  const totalInstances = dayStats.reduce((sum, day) => sum + day.connectedInstances, 0);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Estatísticas por Dia</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Relatório detalhado de logins e mensagens diárias na plataforma
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Logins
              </CardTitle>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLogins.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mensagens Recebidas
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReceived.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mensagens Enviadas
              </CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSent.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Instâncias Conectadas
              </CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalInstances.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Estatísticas por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Dia</TableHead>
                  <TableHead className="text-right">Logins</TableHead>
                  <TableHead className="text-right">Msg Recebidas</TableHead>
                  <TableHead className="text-right">Msg Enviadas</TableHead>
                  <TableHead className="text-right">Instâncias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(7)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : dayStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum dado registrado
                    </TableCell>
                  </TableRow>
                ) : (
                  dayStats.map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {format(new Date(day.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">{day.logins.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{day.messagesReceived.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{day.messagesSent.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{day.connectedInstances.toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}