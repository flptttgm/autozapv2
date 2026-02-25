import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

type PaymentStatusType = "processing" | "success" | "error";

interface PaymentStatusProps {
  status: PaymentStatusType;
  message?: string;
  onRetry?: () => void;
}

export function PaymentStatus({ status, message, onRetry }: PaymentStatusProps) {
  const navigate = useNavigate();

  if (status === "processing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
          <h3 className="text-xl font-semibold mb-2">Processando Pagamento</h3>
          <p className="text-muted-foreground text-center">
            {message || "Aguarde enquanto processamos seu pagamento..."}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Pagamento Confirmado!</h3>
          <p className="text-muted-foreground text-center mb-6">
            {message || "Seu plano foi ativado com sucesso. Aproveite!"}
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            Ir para o Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Erro no Pagamento</h3>
        <p className="text-muted-foreground text-center mb-6">
          {message || "Houve um problema ao processar seu pagamento. Por favor, tente novamente."}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/plans")}>
            Voltar aos Planos
          </Button>
          {onRetry && (
            <Button onClick={onRetry}>
              Tentar Novamente
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
