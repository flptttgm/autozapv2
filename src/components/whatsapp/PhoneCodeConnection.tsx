import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check
} from "lucide-react";
import { WhatsAppTutorialAnimation } from "./WhatsAppTutorialAnimation";
import { toast } from "sonner";

interface PhoneCodeConnectionProps {
  instanceId: string;
  onConnected: () => void;
  onExpired?: () => void;
}

export const PhoneCodeConnection = ({ 
  instanceId, 
  onConnected,
  onExpired 
}: PhoneCodeConnectionProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [codeExpiry, setCodeExpiry] = useState(180);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Countdown timer for code expiry
  useEffect(() => {
    if (pairingCode && codeExpiry > 0) {
      const timer = setTimeout(() => setCodeExpiry(codeExpiry - 1), 1000);
      return () => clearTimeout(timer);
    } else if (codeExpiry === 0 && pairingCode) {
      setPairingCode(null);
      setError("Código expirado. Gere um novo.");
    }
  }, [codeExpiry, pairingCode]);

  // Format phone number as user types
  const handlePhoneChange = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, "");
    
    // Apply Brazilian phone mask: (11) 99999-9999
    let formatted = digits;
    if (digits.length > 0) {
      formatted = `(${digits.slice(0, 2)}`;
      if (digits.length > 2) {
        formatted += `) ${digits.slice(2, 7)}`;
        if (digits.length > 7) {
          formatted += `-${digits.slice(7, 11)}`;
        }
      }
    }
    
    setPhoneNumber(formatted);
  };

  const requestPhoneCode = async () => {
    // Validate phone
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=phone-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            instance_db_id: instanceId,
            phone: digits
          })
        }
      );

      const data = await response.json();
      console.log('[PhoneCodeConnection] Response:', data);

      if (data.needsRecreate) {
        setError("Conexão expirada. Recriando...");
        onExpired?.();
        return;
      }

      if (!data.success || !data.code) {
        throw new Error(data.error || 'Não foi possível gerar o código');
      }

      setPairingCode(data.code);
      setCodeExpiry(180);
      toast.success("Código gerado! Siga as instruções abaixo.");

    } catch (err) {
      console.error('[PhoneCodeConnection] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar código');
      toast.error("Erro ao gerar código de pareamento");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Erro ao copiar código");
    }
  };

  if (pairingCode) {
    return (
      <div className="space-y-6 w-full max-w-sm mx-auto">
        {/* Código de Pareamento */}
        <div className="text-center space-y-3">
          <Label className="text-sm text-muted-foreground">
            Seu código de pareamento
          </Label>
          <div 
            className="relative text-4xl sm:text-5xl font-mono font-bold tracking-[0.3em] bg-muted/50 py-6 px-4 rounded-2xl border-2 border-primary/20 cursor-pointer hover:bg-muted/70 transition-colors group"
            onClick={handleCopyCode}
          >
            {pairingCode.slice(0, 4)}-{pairingCode.slice(4)}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              {copied ? (
                <Check className="w-5 h-5 text-green-500" />
              ) : (
                <Copy className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyCode}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar código
              </>
            )}
          </Button>
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-muted-foreground">
              Expira em <span className="font-bold text-foreground">{formatTime(codeExpiry)}</span>
            </span>
          </div>
        </div>

        {/* Tutorial Visual Animado */}
        <div className="bg-muted/30 p-4 rounded-xl border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center mb-4">
            Como conectar no WhatsApp
          </p>
          <WhatsAppTutorialAnimation />
        </div>

        {/* Botão para gerar novo código */}
        <Button 
          onClick={requestPhoneCode}
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Gerar novo código
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-sm mx-auto">
      {/* Input de Telefone */}
      <div className="space-y-3">
        <Label htmlFor="phone" className="text-sm font-medium">
          Número do seu WhatsApp
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="(11) 99999-9999"
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className="text-center text-lg h-14 font-medium"
          maxLength={16}
        />
        <p className="text-xs text-muted-foreground text-center">
          O mesmo número que você usa no WhatsApp
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Botão Gerar Código */}
      <Button 
        onClick={requestPhoneCode}
        size="lg"
        className="w-full gap-2"
        disabled={isLoading || phoneNumber.replace(/\D/g, "").length < 10}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Gerando código...
          </>
        ) : (
          <>
            <KeyRound className="w-5 h-5" />
            Gerar Código de Conexão
          </>
        )}
      </Button>
    </div>
  );
};

export default PhoneCodeConnection;
