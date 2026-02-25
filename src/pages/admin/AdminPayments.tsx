import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Receipt, Search, Download, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PaymentWithWorkspace {
  id: string;
  workspace_id: string;
  asaas_payment_id: string;
  billing_type: string;
  status: string;
  plan_type: string;
  billing_cycle: string;
  value: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string | null;
}

export default function AdminPayments() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const { data: stats } = useQuery({
    queryKey: ['admin-payment-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('payments_history')
        .select('status, value');
      
      const counts = {
        total: data?.length || 0,
        confirmed: 0,
        pending: 0,
        overdue: 0,
        totalValue: 0,
        confirmedValue: 0,
      };
      
      data?.forEach(payment => {
        if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
          counts.confirmed++;
          counts.confirmedValue += Number(payment.value);
        } else if (payment.status === 'PENDING') {
          counts.pending++;
        } else if (payment.status === 'OVERDUE') {
          counts.overdue++;
        }
        counts.totalValue += Number(payment.value);
      });
      
      return counts;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', page, statusFilter, typeFilter, search],
    queryFn: async () => {
      let query = supabase
        .from('payments_history')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter && typeFilter !== 'all') {
        query = query.eq('billing_type', typeFilter);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      let filtered = (data || []) as PaymentWithWorkspace[];
      
      // Apply search filter (by workspace_id)
      if (search) {
        filtered = filtered.filter(p => 
          p.workspace_id.includes(search) ||
          p.asaas_payment_id.includes(search)
        );
      }
      
      const total = search ? filtered.length : (count ?? 0);
      const paginated = search 
        ? filtered.slice(page * pageSize, (page + 1) * pageSize)
        : filtered;
      
      return { payments: paginated, count: total };
    },
  });

  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'RECEIVED':
        return <Badge variant="default" className="bg-green-500">Confirmado</Badge>;
      case 'PENDING':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'OVERDUE':
        return <Badge variant="destructive">Vencido</Badge>;
      case 'REFUNDED':
        return <Badge variant="outline">Reembolsado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBillingTypeBadge = (type: string) => {
    switch (type) {
      case 'PIX':
        return <Badge variant="outline">PIX</Badge>;
      case 'BOLETO':
        return <Badge variant="outline">Boleto</Badge>;
      case 'CREDIT_CARD':
        return <Badge variant="outline">Cartão</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const exportToCSV = () => {
    if (!data?.payments) return;
    
    const headers = ['ID', 'Workspace', 'Tipo', 'Plano', 'Valor', 'Status', 'Vencimento', 'Pago em'];
    const rows = data.payments.map(p => [
      p.asaas_payment_id,
      p.workspace_id,
      p.billing_type,
      p.plan_type,
      p.value.toFixed(2),
      p.status,
      p.due_date || '-',
      p.paid_at || '-'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Pagamentos</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Histórico de pagamentos da plataforma
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV} className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                {stats?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                R$ {stats?.totalValue.toFixed(2) || '0.00'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Confirmados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-500 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {stats?.confirmed || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                R$ {stats?.confirmedValue.toFixed(2) || '0.00'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-yellow-500 flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                {stats?.pending || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Vencidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {stats?.overdue || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID do pagamento..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="CONFIRMED">Confirmados</SelectItem>
                <SelectItem value="PENDING">Pendentes</SelectItem>
                <SelectItem value="OVERDUE">Vencidos</SelectItem>
                <SelectItem value="REFUNDED">Reembolsados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="BOLETO">Boleto</SelectItem>
                <SelectItem value="CREDIT_CARD">Cartão</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="hidden sm:flex">{data?.count ?? 0} pagamentos</Badge>
          </div>
        </div>

        <ScrollArea className="w-full whitespace-nowrap rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">ID</TableHead>
                <TableHead className="min-w-[80px]">Tipo</TableHead>
                <TableHead className="min-w-[80px]">Plano</TableHead>
                <TableHead className="min-w-[100px]">Valor</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[100px] hidden md:table-cell">Vencimento</TableHead>
                <TableHead className="min-w-[120px] hidden md:table-cell">Pago em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : data?.payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum pagamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data?.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-xs">
                      {payment.asaas_payment_id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>{getBillingTypeBadge(payment.billing_type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{payment.plan_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {Number(payment.value).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {payment.due_date 
                        ? format(new Date(payment.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {payment.paid_at 
                        ? format(new Date(payment.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : '-'
                      }
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
      </div>
    </AdminLayout>
  );
}
