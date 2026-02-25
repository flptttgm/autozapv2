import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, FileText, Loader2, Calendar, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BoletoPaymentProps {
  isProcessing: boolean;
  onSubmit: () => void;
  boletoData?: {
    url: string;
    barcode: string;
    dueDate: string;
  };
}

export function BoletoPayment({ isProcessing, onSubmit, boletoData }: BoletoPaymentProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (boletoData?.barcode) {
      await navigator.clipboard.writeText(boletoData.barcode);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Cole no seu app de banco para pagar.",
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (!boletoData) {
    return (
      <div className="space-y-4">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            O boleto será gerado com vencimento para 3 dias úteis. Após o pagamento, seu plano será ativado em até 3 dias úteis.
          </AlertDescription>
        </Alert>

        <Button 
          onClick={onSubmit} 
          className="w-full" 
          size="lg"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando boleto...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 mr-2" />
              Gerar Boleto
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium">Boleto Gerado</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Vencimento: {new Date(boletoData.dueDate).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        </div>
        <Button asChild>
          <a href={boletoData.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visualizar
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Código de Barras:</p>
        <div className="flex gap-2">
          <Input 
            value={boletoData.barcode} 
            readOnly 
            className="font-mono text-xs"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <Alert className="bg-amber-500/10 border-amber-500/20">
        <Calendar className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          Após o pagamento do boleto, a compensação pode levar até 3 dias úteis. Seu plano será ativado automaticamente após a confirmação.
        </AlertDescription>
      </Alert>
    </div>
  );
}
