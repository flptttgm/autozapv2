import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Filter, Clock, AlertTriangle, CheckCircle, XCircle, SkipForward } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DebugTrace } from "@/pages/admin/AdminDebug";

interface TraceSearchProps {
  onSelectTrace: (traceId: string) => void;
  onSelectEvent: (event: DebugTrace) => void;
}

const statusIcons = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  skipped: <SkipForward className="h-4 w-4 text-yellow-500" />,
  blocked: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  started: <Clock className="h-4 w-4 text-blue-500" />,
};

const statusColors: Record<string, string> = {
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  skipped: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  blocked: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  started: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export function TraceSearch({ onSelectTrace, onSelectEvent }: TraceSearchProps) {
  const [filters, setFilters] = useState({
    traceId: "",
    workspaceId: "",
    functionName: "",
    status: "all",
    phone: "",
    email: "",
  });
  const [emailError, setEmailError] = useState<string | null>(null);

  const { data: traces, isLoading, refetch } = useQuery({
    queryKey: ['debug-search', filters],
    queryFn: async () => {
      setEmailError(null);
      
      let effectiveWorkspaceId = filters.workspaceId;

      // Se tem email, resolver para workspace_id
      if (filters.email && !filters.workspaceId) {
        const { data: wsId, error: wsError } = await supabase
          .rpc('get_workspace_by_email', { user_email: filters.email });
        
        if (wsError) {
          console.error('Error resolving email to workspace:', wsError);
          setEmailError('Erro ao buscar usuário: ' + wsError.message);
          throw new Error('Usuário não encontrado com este email');
        }
        
        if (!wsId) {
          setEmailError('Nenhum workspace encontrado para este email');
          throw new Error('Nenhum workspace encontrado para este email');
        }
        
        effectiveWorkspaceId = wsId;
      }

      let query = supabase
        .from('debug_traces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.traceId) {
        query = query.eq('trace_id', filters.traceId);
      }
      if (effectiveWorkspaceId) {
        query = query.eq('workspace_id', effectiveWorkspaceId);
      }
      if (filters.functionName) {
        query = query.ilike('function_name', `%${filters.functionName}%`);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.phone) {
        query = query.contains('metadata', { phone: filters.phone });
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as DebugTrace[];
    },
    enabled: false, // Only search on button click
  });

  const handleSearch = () => {
    refetch();
  };

  const handleClear = () => {
    setFilters({
      traceId: "",
      workspaceId: "",
      functionName: "",
      status: "all",
      phone: "",
      email: "",
    });
    setEmailError(null);
  };

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="traceId">Trace ID</Label>
              <Input
                id="traceId"
                placeholder="UUID do trace..."
                value={filters.traceId}
                onChange={(e) => setFilters({ ...filters, traceId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceId">Workspace ID</Label>
              <Input
                id="workspaceId"
                placeholder="UUID do workspace..."
                value={filters.workspaceId}
                onChange={(e) => setFilters({ ...filters, workspaceId: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="functionName">Função</Label>
              <Input
                id="functionName"
                placeholder="Nome da função..."
                value={filters.functionName}
                onChange={(e) => setFilters({ ...filters, functionName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                  <SelectItem value="skipped">Ignorado</SelectItem>
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                  <SelectItem value="started">Iniciado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                placeholder="Número do telefone..."
                value={filters.phone}
                onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email do Usuário</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com"
                value={filters.email}
                onChange={(e) => setFilters({ ...filters, email: e.target.value })}
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} className="gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button variant="outline" onClick={handleClear}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      <Card>
        <CardHeader>
          <CardTitle>
            Resultados {traces && `(${traces.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !traces ? (
            <div className="text-center py-8 text-muted-foreground">
              Use os filtros acima para buscar eventos
            </div>
          ) : traces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum evento encontrado
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {traces.map((trace) => (
                <div
                  key={trace.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${statusColors[trace.status] || ''}`}
                  onClick={() => {
                    onSelectTrace(trace.trace_id);
                    onSelectEvent(trace);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusIcons[trace.status as keyof typeof statusIcons]}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                          {trace.function_name}
                        </code>
                        <span className="text-sm font-medium">{trace.event_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {trace.event_type}
                        </Badge>
                      </div>
                      
                      {trace.error_message && (
                        <p className="text-sm text-destructive mt-1 truncate">
                          {trace.error_message}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(trace.created_at), "dd/MM/yyyy HH:mm:ss.SSS", { locale: ptBR })}
                        </span>
                        {trace.duration_ms && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {trace.duration_ms}ms
                          </span>
                        )}
                        <span className="font-mono text-[10px] opacity-50">
                          {trace.trace_id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
