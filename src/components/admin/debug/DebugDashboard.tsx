import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Clock, Activity, TrendingUp } from "lucide-react";
import { format, subHours, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DebugDashboardProps {
  onSelectTrace: (traceId: string) => void;
}

export function DebugDashboard({ onSelectTrace }: DebugDashboardProps) {
  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['debug-metrics'],
    queryFn: async () => {
      const now = new Date();
      const oneDayAgo = subDays(now, 1);
      const oneHourAgo = subHours(now, 1);

      // Total traces last 24h
      const { count: totalTraces } = await supabase
        .from('debug_traces')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo.toISOString());

      // Errors last hour
      const { count: errorsLastHour } = await supabase
        .from('debug_traces')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', oneHourAgo.toISOString());

      // Errors last 24h
      const { count: errorsLast24h } = await supabase
        .from('debug_traces')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', oneDayAgo.toISOString());

      // Average duration
      const { data: durationData } = await supabase
        .from('debug_traces')
        .select('duration_ms')
        .not('duration_ms', 'is', null)
        .gte('created_at', oneDayAgo.toISOString())
        .limit(1000);

      const avgDuration = durationData?.length 
        ? Math.round(durationData.reduce((acc, d) => acc + (d.duration_ms || 0), 0) / durationData.length)
        : 0;

      return {
        totalTraces: totalTraces || 0,
        errorsLastHour: errorsLastHour || 0,
        errorsLast24h: errorsLast24h || 0,
        avgDuration,
      };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch recent errors
  const { data: recentErrors, isLoading: errorsLoading } = useQuery({
    queryKey: ['debug-recent-errors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('debug_traces')
        .select('*')
        .eq('status', 'error')
        .order('created_at', { ascending: false })
        .limit(10);

      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch errors by function
  const { data: errorsByFunction, isLoading: functionErrorsLoading } = useQuery({
    queryKey: ['debug-errors-by-function'],
    queryFn: async () => {
      const oneDayAgo = subDays(new Date(), 1);
      
      const { data } = await supabase
        .from('debug_traces')
        .select('function_name')
        .eq('status', 'error')
        .gte('created_at', oneDayAgo.toISOString());

      if (!data) return [];

      // Group by function
      const counts: Record<string, number> = {};
      data.forEach(d => {
        counts[d.function_name] = (counts[d.function_name] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Eventos (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.totalTraces.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Erros/Hora</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {metrics?.errorsLastHour}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Erros (24h)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.errorsLast24h}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Duração Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.avgDuration}ms</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Errors by Function */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Erros por Função</CardTitle>
          </CardHeader>
          <CardContent>
            {functionErrorsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : errorsByFunction?.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Nenhum erro nas últimas 24h
              </div>
            ) : (
              <div className="space-y-3">
                {errorsByFunction?.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {item.name}
                    </code>
                    <Badge variant="destructive">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Erros Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {errorsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentErrors?.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Nenhum erro registrado
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {recentErrors?.map((error) => (
                  <div 
                    key={error.id} 
                    className="flex items-start justify-between gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1 rounded">
                          {error.function_name}
                        </code>
                        <span className="text-xs text-muted-foreground">
                          {error.event_name}
                        </span>
                      </div>
                      <p className="text-sm text-destructive truncate mt-1">
                        {error.error_message || 'Erro desconhecido'}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(error.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectTrace(error.trace_id)}
                    >
                      Ver
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
