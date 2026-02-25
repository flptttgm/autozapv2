import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Send,
  CheckCircle,
  XCircle,
  Copy,
  User,
  Calendar,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: string;
  amount: number;
  description: string | null;
  due_date: string;
  status: string;
  pix_code: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  source: string;
  lead?: {
    id: string;
    name: string | null;
    phone: string;
  } | null;
}

interface InvoiceCardProps {
  invoice: Invoice;
  onResend: (invoiceId: string) => void;
  onMarkPaid: (invoiceId: string) => void;
  onCancel: (invoiceId: string) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  sent: { label: "Enviada", variant: "default" },
  paid: { label: "Paga", variant: "outline" },
  overdue: { label: "Vencida", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "secondary" },
};

const sourceLabels: Record<string, string> = {
  manual: "Manual",
  scheduled: "Agendada",
  agent: "Agente IA",
};

export function InvoiceCard({ invoice, onResend, onMarkPaid, onCancel }: InvoiceCardProps) {
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(invoice.amount);

  const dueDate = new Date(invoice.due_date);
  const formattedDueDate = format(dueDate, "dd 'de' MMM", { locale: ptBR });

  const statusInfo = statusConfig[invoice.status] || statusConfig.pending;

  const handleCopyPixCode = async () => {
    if (invoice.pix_code) {
      await navigator.clipboard.writeText(invoice.pix_code);
      toast.success("Código PIX copiado!");
    }
  };

  return (
    <Card className="glass border-border/40 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Lead Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate">
                {invoice.lead?.name || invoice.lead?.phone || "Lead removido"}
              </p>
              {invoice.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {invoice.description}
                </p>
              )}
            </div>
          </div>

          {/* Amount */}
          <div className="text-right shrink-0">
            <p className="font-bold text-lg">{formattedAmount}</p>
            <Badge variant={statusInfo.variant} className="mt-1">
              {statusInfo.label}
            </Badge>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {invoice.pix_code && (
                <DropdownMenuItem onClick={handleCopyPixCode}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Código PIX
                </DropdownMenuItem>
              )}
              {(invoice.status === "pending" || invoice.status === "sent") && (
                <>
                  <DropdownMenuItem onClick={() => onResend(invoice.id)}>
                    <Send className="h-4 w-4 mr-2" />
                    {invoice.status === "pending" ? "Enviar" : "Reenviar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMarkPaid(invoice.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Paga
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onCancel(invoice.id)}
                    className="text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </DropdownMenuItem>
                </>
              )}
              {invoice.status === "overdue" && (
                <>
                  <DropdownMenuItem onClick={() => onResend(invoice.id)}>
                    <Send className="h-4 w-4 mr-2" />
                    Reenviar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMarkPaid(invoice.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Paga
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Footer Info */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Vence {formattedDueDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{sourceLabels[invoice.source] || invoice.source}</span>
          </div>
          {invoice.sent_at && (
            <span className="text-green-600">
              Enviada em {format(new Date(invoice.sent_at), "dd/MM HH:mm")}
            </span>
          )}
          {invoice.paid_at && (
            <span className="text-green-600">
              Paga em {format(new Date(invoice.paid_at), "dd/MM HH:mm")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
