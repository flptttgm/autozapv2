import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Smartphone, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Search, 
  RefreshCw,
  AlertTriangle,
  Clock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Interface that matches the RPC return type
interface WhatsAppInstanceFromRPC {
  id: string;
  workspace_id: string;
  workspace_name: string | null;
  instance_id: string;
  instance_token: string | null;
  phone_number: string | null;
  status: string | null;
  is_active: boolean | null;
  created_at: string | null;
  owner_email: string | null;
  subscribed: boolean | null;
  subscribed_at: string | null;
}

// Extended interface for UI display
interface WhatsAppInstanceWithUser extends WhatsAppInstanceFromRPC {
  phone?: string | null;
  connected_at?: string | null;
  owner_name?: string | null;
  plan_type?: string | null;
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export default function AdminWhatsApp() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  
  
  const pageSize = 15;
  const queryClient = useQueryClient();

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['admin-whatsapp-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('status, subscribed, created_at');
      
      const now = Date.now();
      const counts = {
        connected: 0,
        disconnected: 0,
        pending: 0,
        total: data?.length || 0,
        subscribed: 0,
        notSubscribed: 0,
        expired: 0,
      };
      
      data?.forEach(instance => {
        if (instance.status === 'connected') {
          counts.connected++;
        } else if (instance.status === 'disconnected') {
          counts.disconnected++;
        } else {
          counts.pending++;
        }
        
        if (instance.subscribed) {
          counts.subscribed++;
        } else {
          counts.notSubscribed++;
          // Check if expired (>2 days old and not subscribed)
          if (instance.created_at) {
            const age = now - new Date(instance.created_at).getTime();
            if (age > TWO_DAYS_MS) {
              counts.expired++;
            }
          }
        }
      });
      
      return counts;
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-whatsapp-instances', page, statusFilter, subscriptionFilter, search],
    queryFn: async () => {
      const { data: allInstances, error } = await supabase.rpc('get_admin_whatsapp_instances');
      
      if (error) throw error;
      
      // Map RPC response to WhatsAppInstanceWithUser format
      let filtered: WhatsAppInstanceWithUser[] = (allInstances || []).map((i: WhatsAppInstanceFromRPC) => ({
        ...i,
        phone: i.phone_number,
        connected_at: null,
        owner_name: null,
        plan_type: null,
      }));
      
      const now = Date.now();
      
      // Apply status filter
      if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(i => i.status === statusFilter);
      }
      
      // Apply subscription filter
      if (subscriptionFilter && subscriptionFilter !== 'all') {
        if (subscriptionFilter === 'subscribed') {
          filtered = filtered.filter(i => i.subscribed === true);
        } else if (subscriptionFilter === 'not_subscribed') {
          filtered = filtered.filter(i => !i.subscribed);
        } else if (subscriptionFilter === 'expired') {
          filtered = filtered.filter(i => {
            if (i.subscribed) return false;
            if (!i.created_at) return false;
            const age = now - new Date(i.created_at).getTime();
            return age > TWO_DAYS_MS;
          });
        }
      }
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(i => 
          i.owner_name?.toLowerCase().includes(searchLower) ||
          i.owner_email?.toLowerCase().includes(searchLower) ||
          i.workspace_name?.toLowerCase().includes(searchLower) ||
          i.phone_number?.includes(search)
        );
      }
      
      const total = filtered.length;
      const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
      
      return { instances: paginated, count: total, allFiltered: filtered };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  const isExpired = (instance: WhatsAppInstanceWithUser) => {
    if (instance.subscribed) return false;
    if (!instance.created_at) return false;
    const age = Date.now() - new Date(instance.created_at).getTime();
    return age > TWO_DAYS_MS;
  };



  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Conectado</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'disconnected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPlanBadge = (planType: string | null) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      enterprise: "default",
      pro: "default",
      basic: "secondary",
      trial: "outline",
    };
    return variants[planType || 'trial'] || "secondary";
  };

  const getSubscriptionBadge = (instance: WhatsAppInstanceWithUser) => {
    if (instance.subscribed) {
      return (
        <Badge variant="default" className="bg-green-500 text-white">
          <CheckCircle className="h-3 w-3 mr-1" />
          Assinada
        </Badge>
      );
    }
    
    if (isExpired(instance)) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expirada
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-500">
        <Clock className="h-3 w-3 mr-1" />
        Não assinada
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">WhatsApp</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Monitore instâncias e assinaturas Z-API da plataforma
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {stats?.total || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conectados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {stats?.connected || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Desconectados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                {stats?.disconnected || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {stats?.pending || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Assinadas Z-API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {stats?.subscribed || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Expiradas (&gt;2 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {stats?.expired || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <Smartphone className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="connected">Conectados</SelectItem>
              <SelectItem value="disconnected">Desconectados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={subscriptionFilter} onValueChange={(v) => { setSubscriptionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <RefreshCw className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Assinatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Assinaturas</SelectItem>
              <SelectItem value="subscribed">Assinadas</SelectItem>
              <SelectItem value="not_subscribed">Não Assinadas</SelectItem>
              <SelectItem value="expired">Expiradas (&gt;2 dias)</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{data?.count ?? 0} instâncias</Badge>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Assinatura Z-API</TableHead>
                <TableHead>Idade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : data?.instances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma instância encontrada
                  </TableCell>
                </TableRow>
              ) : (
                data?.instances.map((instance) => (
                  <TableRow key={instance.id} className={isExpired(instance) ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(instance.status)}
                        {getStatusBadge(instance.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{instance.owner_email || 'Sem nome'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{instance.workspace_name || '-'}</TableCell>
                    <TableCell>{instance.phone_number || '-'}</TableCell>
                    <TableCell>
                      {getSubscriptionBadge(instance)}
                      {instance.subscribed_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(instance.subscribed_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {instance.created_at ? (
                        <span className={`text-sm ${isExpired(instance) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {formatDistanceToNow(new Date(instance.created_at), { locale: ptBR, addSuffix: false })}
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
      </div>
    </AdminLayout>
  );
}