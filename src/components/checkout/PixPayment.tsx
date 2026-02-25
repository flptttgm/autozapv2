import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, QrCode, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PixPaymentProps {
  isProcessing: boolean;
  onSubmit: () => void;
  pixData?: {
    qrCode: string;
    copyPaste: string;
    expiresAt?: string;
  };
}

export function PixPayment({ isProcessing, onSubmit, pixData }: PixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    if (pixData?.copyPaste) {
      await navigator.clipboard.writeText(pixData.copyPaste);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Cole no seu app de banco para pagar.",
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (!pixData) {
    return (
      <div className="space-y-4">
        <Alert>
          <QrCode className="h-4 w-4" />
          <AlertDescription>
            O PIX é a forma mais rápida de pagamento. Após gerar o código, você terá 30 minutos para realizar o pagamento.
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
              Gerando PIX...
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4 mr-2" />
              Gerar QR Code PIX
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-lg">
          <img 
            src={`data:image/png;base64,${pixData.qrCode}`} 
            alt="QR Code PIX" 
            className="w-48 h-48"
          />
        </div>

        {pixData.expiresAt && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Válido até {new Date(pixData.expiresAt).toLocaleString("pt-BR")}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Ou copie o código PIX:</p>
        <div className="flex gap-2">
          <Input 
            value={pixData.copyPaste} 
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
        <Clock className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          Aguardando confirmação do pagamento. Assim que o pagamento for confirmado, seu plano será ativado automaticamente.
        </AlertDescription>
      </Alert>
    </div>
  );
}
