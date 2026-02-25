import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Brain, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Loader2,
  Building2
} from "lucide-react";
import { toast } from "sonner";

interface EmbeddingStats {
  total_items: number;
  items_with_embedding: number;
  items_pending: number;
  items_failed: number;
  workspaces_count: number;
}

interface WorkspaceEmbeddingStats {
  workspace_id: string;
  workspace_name: string | null;
  total_items: number;
  items_completed: number;
  items_pending: number;
  items_failed: number;
}

interface QualityStats {
  tipo: string;
  total: number;
}

export function EmbeddingMonitor() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['embedding-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_embedding_stats');
      if (error) throw error;
      return data?.[0] as EmbeddingStats | null;
    },
    refetchInterval: isSyncing ? 3000 : false,
  });

  const { data: workspaceStats, isLoading: workspaceLoading } = useQuery({
    queryKey: ['embedding-stats-by-workspace'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_embedding_stats_by_workspace');
      if (error) throw error;
      return data as WorkspaceEmbeddingStats[];
    },
    refetchInterval: isSyncing ? 3000 : false,
  });

  const { data: qualityStats } = useQuery({
    queryKey: ['embedding-quality-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_embedding_quality_stats');
      if (error) throw error;
      return data as QualityStats[];
    },
    refetchInterval: isSyncing ? 3000 : false,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-embeddings', {
        body: { batch_size: 50 }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setIsSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['embedding-stats'] });
      queryClient.invalidateQueries({ queryKey: ['embedding-stats-by-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['embedding-quality-stats'] });
      
      if (data.processed > 0 || data.failed > 0) {
        toast.success(`Sincronização concluída: ${data.processed} processados, ${data.failed} falhas`);
      } else {
        toast.info('Nenhum item para sincronizar');
      }
      
      // If there are more items, run again
      if (data.has_more) {
        toast.info('Ainda há mais itens. Execute novamente para continuar.');
      }
    },
    onError: (error) => {
      setIsSyncing(false);
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar embeddings');
    },
  });

  const migrateAllMutation = useMutation({
    mutationFn: async () => {
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('generate-embedding', {
        body: { action: 'migrate_all_workspaces' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setIsSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['embedding-stats'] });
      queryClient.invalidateQueries({ queryKey: ['embedding-stats-by-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['embedding-quality-stats'] });
      
      toast.success(`Migração completa: ${data.processed} processados, ${data.failed} falhas`);
      
      if (data.remaining) {
        toast.info('Ainda há mais itens. Execute novamente para continuar.');
      }
    },
    onError: (error) => {
      setIsSyncing(false);
      console.error('Migration error:', error);
      toast.error('Erro ao migrar embeddings');
    },
  });

  const completionPercentage = stats 
    ? Math.round((stats.items_with_embedding / Math.max(stats.total_items, 1)) * 100)
    : 0;

  const needsAttention = (stats?.items_pending || 0) > 0 || (stats?.items_failed || 0) > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Brain className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
          <span className="truncate">Embeddings</span>
          {needsAttention && (
            <Badge variant="destructive" className="ml-auto text-xs shrink-0">
              Atenção
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Sistema RAG - Base de Conhecimento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {statsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : stats ? (
          <>
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-1.5" />
            </div>

            {/* Stats Grid - 2x2 on mobile */}
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-1.5 sm:p-2 bg-muted/50 rounded-lg">
                <p className="text-lg sm:text-xl font-bold">{stats.total_items}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-1.5 sm:p-2 bg-green-500/10 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                  <p className="text-lg sm:text-xl font-bold text-green-600">{stats.items_with_embedding}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">OK</p>
              </div>
              <div className="text-center p-1.5 sm:p-2 bg-yellow-500/10 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                  <p className="text-lg sm:text-xl font-bold text-yellow-600">{stats.items_pending}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Pendentes</p>
              </div>
              <div className="text-center p-1.5 sm:p-2 bg-red-500/10 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                  <p className="text-lg sm:text-xl font-bold text-red-600">{stats.items_failed}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Falhas</p>
              </div>
            </div>

            {/* Quality Stats */}
            {qualityStats && qualityStats.length > 0 && (
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {qualityStats.map((q) => (
                  <Badge 
                    key={q.tipo} 
                    variant={q.tipo === 'AI_GENERATED' ? 'default' : 'outline'}
                    className={`text-[10px] ${
                      q.tipo === 'AI_GENERATED' ? 'bg-primary/20 text-primary' : 
                      q.tipo === 'HASH_FALLBACK' ? 'border-destructive text-destructive' : 
                      'border-muted-foreground'
                    }`}
                  >
                    {q.tipo === 'AI_GENERATED' ? '✓ AI' : q.tipo === 'HASH_FALLBACK' ? '⚠ Hash' : '∅ Sem'}: {q.total}
                  </Badge>
                ))}
              </div>
            )}

            {/* Workspace Count */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{stats.workspaces_count} workspaces</span>
            </div>

            {/* Action Buttons - Stack on mobile */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={() => syncMutation.mutate()}
                disabled={isSyncing}
                size="sm"
                className="w-full sm:w-auto text-xs h-8"
              >
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                )}
                Sincronizar
              </Button>
              
              {needsAttention && (
                <Button 
                  onClick={() => migrateAllMutation.mutate()}
                  disabled={isSyncing}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-xs h-8"
                >
                  {isSyncing ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <Brain className="h-3 w-3 mr-1.5" />
                  )}
                  Migrar Todos
                </Button>
              )}
            </div>

            {/* Workspace Details (collapsed by default) */}
            {workspaceStats && workspaceStats.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                  Detalhes ({workspaceStats.length})
                </summary>
                <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                  {workspaceStats.map((ws) => (
                    <div 
                      key={ws.workspace_id} 
                      className="flex items-center justify-between text-xs p-1.5 bg-muted/30 rounded gap-2"
                    >
                      <span className="truncate min-w-0 flex-1">
                        {ws.workspace_name || ws.workspace_id.substring(0, 8)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-green-600 text-[10px] px-1.5 py-0">
                          {ws.items_completed}
                        </Badge>
                        {ws.items_pending > 0 && (
                          <Badge variant="outline" className="text-yellow-600 text-[10px] px-1.5 py-0">
                            {ws.items_pending}
                          </Badge>
                        )}
                        {ws.items_failed > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            {ws.items_failed}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado disponível</p>
        )}
      </CardContent>
    </Card>
  );
}
