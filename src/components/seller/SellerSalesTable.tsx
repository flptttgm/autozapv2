import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Sale {
  id: string;
  plan_type: string;
  billing_cycle: string;
  sale_value: number;
  commission_value: number;
  commission_status: string;
  paid_at: string | null;
  created_at: string;
}

interface SellerSalesTableProps {
  sales: Sale[];
  isLoading?: boolean;
}

export function SellerSalesTable({ sales, isLoading }: SellerSalesTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Pago
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelado
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlanName = (planType: string) => {
    const names: Record<string, string> = {
      start: 'Start',
      pro: 'Pro',
      business: 'Business',
      connection: 'Conexão Extra',
    };
    return names[planType] || planType;
  };

  const getCycleLabel = (cycle: string) => {
    return cycle === 'annual' ? 'Anual' : 'Mensal';
  };

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Histórico de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Histórico de Vendas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma venda realizada ainda.</p>
            <p className="text-sm mt-2">Compartilhe seu link para começar a vender!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead className="text-right">Valor Venda</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getPlanName(sale.plan_type)}
                    </TableCell>
                    <TableCell>{getCycleLabel(sale.billing_cycle)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(sale.sale_value))}
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      {formatCurrency(Number(sale.commission_value))}
                    </TableCell>
                    <TableCell>{getStatusBadge(sale.commission_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
