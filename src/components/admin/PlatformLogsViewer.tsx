import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Search, ChevronLeft, ChevronRight, Filter, Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlatformLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const actionColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  login: "outline",
  logout: "outline",
  signup: "default",
};

const entityTypeLabels: Record<string, string> = {
  user: "Usuário",
  subscription: "Assinatura",
  whatsapp: "WhatsApp",
  payment: "Pagamento",
  ab_test: "Teste A/B",
  lead: "Lead",
  appointment: "Agendamento",
  knowledge_base: "Base de Conhecimento",
  config: "Configuração",
};

export function PlatformLogsViewer() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<PlatformLog | null>(null);
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['platform-logs', page, search, actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from('platform_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (search) {
        query = query.or(`user_email.ilike.%${search}%,entity_type.ilike.%${search}%,entity_id.ilike.%${search}%`);
      }

      if (actionFilter && actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (entityFilter && entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      return { logs: data as PlatformLog[], count: count ?? 0 };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  const handleExport = () => {
    if (!data?.logs.length) return;
    
    const csvContent = [
      ['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'ID', 'IP', 'Detalhes'].join(';'),
      ...data.logs.map(log => [
        format(new Date(log.created_at), "dd/MM/yyyy HH:mm"),
        log.user_email || 'Sistema',
        log.action,
        log.entity_type,
        log.entity_id || '-',
        log.ip_address || '-',
        JSON.stringify(log.details || {})
      ].join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar logs..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="signup">Cadastro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Entidades</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="payment">Pagamento</SelectItem>
                <SelectItem value="subscription">Assinatura</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="appointment">Agendamento</SelectItem>
                <SelectItem value="knowledge_base">Base de Conhecimento</SelectItem>
                <SelectItem value="config">Configuração</SelectItem>
                <SelectItem value="ab_test">Teste A/B</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <Badge variant="secondary">{data?.count ?? 0} logs</Badge>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.logs.length}>
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[130px]">Data/Hora</TableHead>
              <TableHead className="min-w-[150px] hidden md:table-cell">Usuário</TableHead>
              <TableHead className="min-w-[80px]">Ação</TableHead>
              <TableHead className="min-w-[100px]">Entidade</TableHead>
              <TableHead className="min-w-[80px] hidden lg:table-cell">ID</TableHead>
              <TableHead className="min-w-[100px] hidden lg:table-cell">IP</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                </TableRow>
              ))
            ) : data?.logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            ) : (
              data?.logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm hidden md:table-cell truncate max-w-[150px]">
                    {log.user_email || 'Sistema'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionColors[log.action] || "secondary"}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {entityTypeLabels[log.entity_type] || log.entity_type}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-xs hidden lg:table-cell">
                    {log.entity_id ? log.entity_id.slice(0, 8) + '...' : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                    {log.ip_address || '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data/Hora</p>
                  <p>{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Usuário</p>
                  <p className="truncate">{selectedLog.user_email || 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ação</p>
                  <Badge variant={actionColors[selectedLog.action] || "secondary"}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entidade</p>
                  <p>{entityTypeLabels[selectedLog.entity_type] || selectedLog.entity_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ID da Entidade</p>
                  <p className="font-mono text-sm break-all">{selectedLog.entity_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User ID</p>
                  <p className="font-mono text-sm break-all">{selectedLog.user_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP</p>
                  <p>{selectedLog.ip_address || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">User Agent</p>
                  <p className="text-sm break-all">
                    {selectedLog.user_agent || '-'}
                  </p>
                </div>
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Detalhes Adicionais</p>
                  <ScrollArea className="h-[200px] rounded-md border p-4">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
