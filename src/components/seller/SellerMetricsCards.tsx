import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

interface SellerMetricsCardsProps {
  totalSales: number;
  pendingCommission: number;
  paidCommission: number;
  totalCommission: number;
}

export function SellerMetricsCards({
  totalSales,
  pendingCommission,
  paidCommission,
  totalCommission,
}: SellerMetricsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const metrics = [
    {
      label: "Total de Vendas",
      value: totalSales.toString(),
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Taxa Pendente",
      value: formatCurrency(pendingCommission),
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      label: "Taxa Paga",
      value: formatCurrency(paidCommission),
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Total Ganho",
      value: formatCurrency(totalCommission),
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 sm:p-3 rounded-xl ${metric.bgColor}`}>
                <metric.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${metric.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{metric.label}</p>
                <p className="text-lg sm:text-2xl font-bold truncate">{metric.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
