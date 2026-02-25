import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Phone as PhoneIcon,
  MessageSquare,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface AvailabilityResult {
  available: boolean;
  blocked: boolean;
  appealToken?: string | null;
  smsWaitSeconds: number;
  voiceWaitSeconds: number;
  waOldWaitSeconds: number;
  waOldEligible: boolean;
  reason?: string | null;
}

interface MobileAvailabilityCheckProps {
  instanceId: string;
  onAvailable?: (result: AvailabilityResult) => void;
}

export const MobileAvailabilityCheck = ({ 
  instanceId, 
  onAvailable 
}: MobileAvailabilityCheckProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setResult(null);
    setError(null);
  };

  const checkAvailability = async () => {
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      toast.error("Digite um número de telefone válido");
      return;
    }

    try {
      setIsChecking(true);
      setError(null);
      setResult(null);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-partners?action=mobile-check-availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            instance_db_id: instanceId,
            phone: digits,
            ddi: '55'
          })
        }
      );

      const data = await response.json();
      console.log('[MobileAvailabilityCheck] Response:', data);

      if (!data.success) {
        throw new Error(data.error || 'Erro ao verificar disponibilidade');
      }

      setResult(data);
      
      if (data.available) {
        toast.success("Número disponível para registro mobile!");
        onAvailable?.(data);
      } else if (data.blocked) {
        toast.error("Número bloqueado/banido pelo WhatsApp");
      } else {
        toast.warning("Número indisponível para registro mobile");
      }

    } catch (err) {
      console.error('[MobileAvailabilityCheck] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      toast.error("Erro ao verificar disponibilidade");
    } finally {
      setIsChecking(false);
    }
  };

  const formatWaitTime = (seconds: number) => {
    if (seconds === 0) return "Disponível agora";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `Aguardar ${mins}min ${secs}s`;
    }
    return `Aguardar ${secs}s`;
  };

  return (
    <div className="space-y-5 w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
        <Smartphone className="w-5 h-5 text-purple-500 shrink-0" />
        <div className="text-left">
          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Verificar Registro Mobile
          </p>
          <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">
            Verifica se o número pode ser registrado como dispositivo primário
          </p>
        </div>
      </div>

      {/* Input de Telefone */}
      <div className="space-y-3">
        <Label htmlFor="phone-mobile" className="text-sm font-medium">
          Número do WhatsApp
        </Label>
        <Input
          id="phone-mobile"
          type="tel"
          placeholder="(11) 99999-9999"
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className="text-center text-lg h-14 font-medium"
          maxLength={16}
        />
        <p className="text-xs text-muted-foreground text-center">
          Digite o número que deseja verificar
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {result.available && !result.blocked && (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                    Número disponível!
                  </p>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">
                    Este número pode ser registrado como dispositivo primário via Z-API Mobile.
                  </p>
                  
                  {/* Available methods */}
                  <div className="pt-2 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                      Métodos disponíveis:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        result.smsWaitSeconds === 0 
                          ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}>
                        <MessageSquare className="w-3 h-3" />
                        SMS: {formatWaitTime(result.smsWaitSeconds)}
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                        result.voiceWaitSeconds === 0 
                          ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                          : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      }`}>
                        <PhoneIcon className="w-3 h-3" />
                        Voz: {formatWaitTime(result.voiceWaitSeconds)}
                      </div>
                      {result.waOldEligible && (
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                          result.waOldWaitSeconds === 0 
                            ? 'bg-green-500/20 text-green-700 dark:text-green-300' 
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}>
                          <Smartphone className="w-3 h-3" />
                          Pop-up: {formatWaitTime(result.waOldWaitSeconds)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result.blocked && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    Número bloqueado/banido
                  </p>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80">
                    Este número foi banido pelo WhatsApp e não pode ser registrado.
                  </p>
                  {result.appealToken && (
                    <a 
                      href={`https://web.whatsapp.com/appeal?token=${result.appealToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Solicitar desbanimento
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {!result.available && !result.blocked && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    Número indisponível
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                    {result.reason || "Este número não está disponível para registro mobile no momento."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão Verificar */}
      <Button 
        onClick={checkAvailability}
        size="lg"
        className="w-full gap-2"
        disabled={isChecking || phoneNumber.replace(/\D/g, "").length < 10}
      >
        {isChecking ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <Smartphone className="w-5 h-5" />
            Verificar Disponibilidade
          </>
        )}
      </Button>

      {/* Info box */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          O registro mobile permite que o Z-API seja o dispositivo primário do WhatsApp, 
          oferecendo maior estabilidade. Em breve, o fluxo completo de registro estará disponível.
        </p>
      </div>
    </div>
  );
};

export default MobileAvailabilityCheck;
